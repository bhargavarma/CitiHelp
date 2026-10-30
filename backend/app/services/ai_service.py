import logging
import re
from typing import List, Dict, Any, Tuple
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.models.knowledge import KnowledgeDocument
from app.models.service import Service
from app.core.config import settings

logger = logging.getLogger(__name__)

def extract_keywords(query: str) -> List[str]:
    clean = re.sub(r'[^\w\s]', ' ', query.lower())
    words = clean.split()
    stopwords = {
        "what", "is", "the", "a", "an", "and", "or", "in", "on", "for", "of",
        "to", "how", "do", "i", "can", "get", "apply", "where", "which",
        "my", "me", "about", "tell", "please", "help", "with", "needed", "required"
    }
    keywords = [w for w in words if w not in stopwords and len(w) > 2]
    return keywords if keywords else words

def search_knowledge_and_services(
    db: Session,
    query: str,
    limit: int = 5
) -> List[Dict[str, Any]]:
    keywords = extract_keywords(query)
    results = []
    
    if not keywords:
        return results

    # Search Knowledge Documents
    knowledge_conditions = []
    for kw in keywords[:5]:
        pattern = f"%{kw}%"
        knowledge_conditions.append(KnowledgeDocument.title.ilike(pattern))
        knowledge_conditions.append(KnowledgeDocument.content.ilike(pattern))
        knowledge_conditions.append(KnowledgeDocument.category.ilike(pattern))

    if knowledge_conditions:
        stmt_kd = select(KnowledgeDocument).where(or_(*knowledge_conditions)).limit(limit)
        for doc in db.scalars(stmt_kd).all():
            results.append({
                "type": "Knowledge Base FAQ",
                "title": doc.title,
                "content": doc.content,
                "category": doc.category,
                "source_url": doc.source_url,
                "last_reviewed": doc.last_reviewed,
            })

    # Search Services
    service_conditions = []
    for kw in keywords[:5]:
        pattern = f"%{kw}%"
        service_conditions.append(Service.name.ilike(pattern))
        service_conditions.append(Service.description.ilike(pattern))
        service_conditions.append(Service.procedure.ilike(pattern))
        service_conditions.append(Service.category.ilike(pattern))

    if service_conditions:
        stmt_svc = select(Service).where(or_(*service_conditions)).limit(limit)
        for svc in db.scalars(stmt_svc).all():
            doc_list = ", ".join(svc.required_documents) if isinstance(svc.required_documents, list) else str(svc.required_documents)
            content_summary = (
                f"Department: {svc.department}. Eligibility: {svc.eligibility}. "
                f"Required Documents: {doc_list}. Procedure: {svc.procedure}."
            )
            results.append({
                "type": "Public Service Directory",
                "title": svc.name,
                "content": content_summary,
                "category": svc.category,
                "source_url": svc.source_url,
                "last_reviewed": svc.last_reviewed,
            })

    return results[:limit]

def answer_citizen_query(
    db: Session,
    question: str
) -> Tuple[str, List[Dict[str, Any]]]:
    matched_records = search_knowledge_and_services(db, question, limit=4)
    
    if not matched_records:
        unsupported_msg = (
            "I apologize, but I do not have verified public service information in the "
            "curated knowledge repository to answer your specific question. "
            "Please explore the Service Directory in the citizen portal or contact your local administrative office."
        )
        return unsupported_msg, []

    # If Gemini API key is configured, invoke Gemini
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip() != "":
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)

            context_blocks = []
            for idx, r in enumerate(matched_records, 1):
                context_blocks.append(
                    f"--- Source [{idx}]: {r['title']} ({r['category']}) ---\n"
                    f"Official Reference: {r['source_url']} (Last Reviewed: {r['last_reviewed']})\n"
                    f"Information: {r['content']}\n"
                )
            context_str = "\n".join(context_blocks)

            prompt = f"""
You are the official AI Assistant for the Public Grievance and Citizen Services Portal.
Answer the citizen's inquiry truthfully, politely, and strictly based ONLY on the provided verified sources below.

RULES:
1. Do NOT invent legal advice, government regulations, fees, or timelines not stated in the sources.
2. Clearly list the required documents and procedural steps if asked.
3. Cite the relevant source names in your answer.
4. If the provided sources do not adequately answer the question, state that clearly and suggest consulting the relevant department.
5. Keep your answer structured, concise, and helpful with bullet points.

VERIFIED SOURCES:
{context_str}

CITIZEN QUESTION:
{question}
"""
            response = model.generate_content(prompt)
            answer_text = response.text.strip()
            
            sources = [
                {
                    "title": r["title"],
                    "source_url": r["source_url"],
                    "last_reviewed": r["last_reviewed"],
                    "relevance_type": r["type"]
                }
                for r in matched_records
            ]
            return answer_text, sources

        except Exception as exc:
            logger.warning(
                "Gemini generation failed; returning grounded deterministic fallback. Error: %s",
                exc,
            )

    # Deterministic fallback response using retrieved records
    sources = [
        {
            "title": r["title"],
            "source_url": r["source_url"],
            "last_reviewed": r["last_reviewed"],
            "relevance_type": r["type"]
        }
        for r in matched_records
    ]
    
    fallback_parts = [
        "**Information Retrieved from Public Service Knowledge Base:**\n"
    ]
    for r in matched_records:
        fallback_parts.append(f"### {r['title']} ({r['category']})")
        fallback_parts.append(f"{r['content']}\n")
        if r.get("source_url"):
            fallback_parts.append(
                f"*Source: {r['source_url']} | Last Reviewed: {r['last_reviewed']}*\n"
            )
        else:
            fallback_parts.append(f"*Last Reviewed: {r['last_reviewed']}*\n")
    
    fallback_parts.append(
        "\n*(Note: Answers are assembled from the curated knowledge base. "
        "Configure GEMINI_API_KEY on the backend for conversational synthesis.)*"
    )
    return "\n".join(fallback_parts), sources
