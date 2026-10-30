import logging
import re
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.service import Service
from app.models.knowledge import KnowledgeDocument
from app.core.security import hash_password
from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICES_DATA = [
    {
        "name": "Issuance of Birth Certificate",
        "category": "Civil Registration",
        "department": "Municipal Administration and Urban Development",
        "description": "Registration of childbirth and formal issuance of digital birth certificate within municipal and panchayat jurisdictions.",
        "eligibility": "Parents or legal guardians of the child born within state administrative jurisdiction.",
        "required_documents": ["Hospital Discharge Summary / Birth Report", "Identity Proof of Parents (Aadhaar/Voter ID)", "Marriage Certificate of Parents", "Address Proof"],
        "procedure": "1. Collect birth slip from hospital. 2. Submit application online on citizen portal or municipal ward office. 3. Verification by Registrar of Births. 4. Download digitally signed certificate.",
        "source_url": "https://crsorgi.gov.in",
        "last_reviewed": "2026-08-15",
        "is_verified": True
    },
    {
        "name": "Issuance of Death Certificate",
        "category": "Civil Registration",
        "department": "Municipal Administration and Urban Development",
        "description": "Official certification of death required for legal inheritance, insurance claims, and municipal records.",
        "eligibility": "Immediate family member, spouse, or authorized next-of-kin.",
        "required_documents": ["Medical Certificate of Cause of Death", "Cremation/Burial Ground Receipt", "Aadhaar Card of Deceased", "Applicant ID Proof"],
        "procedure": "1. Intimate local registrar within 21 days. 2. Upload medical certificate and cremation slip. 3. Verification by sanitary supervisor. 4. Certificate issued within 7 working days.",
        "source_url": "https://crsorgi.gov.in",
        "last_reviewed": "2026-08-15",
        "is_verified": True
    },
    {
        "name": "New Drinking Water Connection",
        "category": "Municipal Services",
        "department": "Water Supply and Sewerage Board",
        "description": "Application for residential or commercial piped potable water tap connection.",
        "eligibility": "Property owner or authorized long-term tenant with property tax receipts.",
        "required_documents": ["Proof of Ownership (Sale Deed / Title Deed)", "Latest Property Tax Receipt", "Sanctioned Building Plan", "Aadhaar Card of Applicant"],
        "procedure": "1. Apply online with property tax assessment number. 2. Site inspection by municipal engineer. 3. Estimation and pipeline connection fee payment. 4. Water meter installation and water release.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-09-01",
        "is_verified": True
    },
    {
        "name": "Property Tax Assessment and Mutation",
        "category": "Revenue & Property",
        "department": "Department of Municipal Revenue",
        "description": "Transfer of property title in municipal records and reassessment of municipal property tax.",
        "eligibility": "Buyer, heir, or transferee of registered immovable property.",
        "required_documents": ["Registered Sale Deed / Gift Deed / Will", "Encumbrance Certificate (EC)", "Prior Property Tax Clearance Receipt", "Identity and Address Proof"],
        "procedure": "1. Submit mutation request referencing Registered Document number. 2. Revenue Inspector verification. 3. 15-day public notice period. 4. Issuance of updated property tax demand notice.",
        "source_url": "https://igrsup.gov.in",
        "last_reviewed": "2026-07-20",
        "is_verified": True
    },
    {
        "name": "National Food Security Card (Ration Card)",
        "category": "Civil Supplies",
        "department": "Department of Consumer Affairs, Food & Civil Supplies",
        "description": "Provision of subsidized food grains and essential commodities to eligible families below the poverty threshold.",
        "eligibility": "Resident families meeting state economic criteria with no existing active ration card.",
        "required_documents": ["Aadhaar Cards of all family members", "Income Certificate from Tahsildar", "Electricity Bill / Gas Connection Slip", "Recent Family Passport Size Photograph"],
        "procedure": "1. Submit family details and Aadhaar seedings online. 2. Civil Supplies Inspector field inquiry. 3. Approval by District Supply Officer. 4. E-Ration card generation.",
        "source_url": "https://nfsa.gov.in",
        "last_reviewed": "2026-08-10",
        "is_verified": True
    },
    {
        "name": "Learner's Driving License",
        "category": "Transport",
        "department": "Regional Transport Office (RTO)",
        "description": "Preliminary license authorizing an individual to learn motor vehicle driving under supervision.",
        "eligibility": "Individuals aged 18 or above (16 for gearless two-wheelers up to 50cc).",
        "required_documents": ["Age Proof (10th marks card/Birth Certificate)", "Address Proof (Aadhaar/Passport)", "Medical Certificate Form 1-A (for transport/over 40)"],
        "procedure": "1. Apply on Sarathi portal. 2. Upload documents and pay statutory fee. 3. Take online/in-person road safety and traffic signs computer test. 4. Instant issuance of learner license.",
        "source_url": "https://parivahan.gov.in",
        "last_reviewed": "2026-09-12",
        "is_verified": True
    },
    {
        "name": "Permanent Driving License (DL)",
        "category": "Transport",
        "department": "Regional Transport Office (RTO)",
        "description": "Full valid driving license after completion of mandatory learner waiting period and road test.",
        "eligibility": "Holders of valid learner's license after 30 days and within 180 days of issue.",
        "required_documents": ["Valid Learner's License", "Form 5 (Driving School Certificate for Commercial)", "Vehicle RC for test"],
        "procedure": "1. Book driving skill test slot on Sarathi portal. 2. Appear at RTO track with test vehicle. 3. Clear practical driving test before Motor Vehicle Inspector. 4. Smart card DL dispatched via speed post.",
        "source_url": "https://parivahan.gov.in",
        "last_reviewed": "2026-09-12",
        "is_verified": True
    },
    {
        "name": "Income Certificate Issuance",
        "category": "Revenue & Property",
        "department": "Revenue Department",
        "description": "Official government validation of annual household income for scholarships, fee concessions, and social schemes.",
        "eligibility": "Permanent resident of the state.",
        "required_documents": ["Salary Slips / Form 16 / Auditor Certificate", "Land holding passbook (if agricultural)", "Aadhaar Card", "Ration Card copy"],
        "procedure": "1. Apply via MeeSeva / e-District portal. 2. Village Revenue Officer (VRO) inquiry. 3. Revenue Inspector endorsement. 4. Approval and digital signature by Tahsildar.",
        "source_url": "https://services.india.gov.in",
        "last_reviewed": "2026-06-30",
        "is_verified": True
    },
    {
        "name": "Community, Nativity and Date of Birth (Caste) Certificate",
        "category": "Revenue & Property",
        "department": "Revenue and Backward Classes Welfare Department",
        "description": "Legal certification of caste category (SC/ST/OBC/BC) for educational reservations and welfare programs.",
        "eligibility": "Citizens belonging to notified communities residing in the state.",
        "required_documents": ["Father / Sibling Caste Certificate copy", "School Transfer Certificate (TC) showing caste", "Family Ration Card / Aadhaar", "Self-declaration affidavit"],
        "procedure": "1. Online application with lineage proof. 2. Field verification by Revenue Inspector. 3. Tahsildar scrutiny and digital approval.",
        "source_url": "https://services.india.gov.in",
        "last_reviewed": "2026-07-15",
        "is_verified": True
    },
    {
        "name": "New Electricity Service Connection (LT)",
        "category": "Energy & Utilities",
        "department": "State Electricity Distribution Company (DISCOM)",
        "description": "Low-tension domestic or commercial power connection to premises.",
        "eligibility": "Lawful occupant or property owner of the electrified premises.",
        "required_documents": ["Ownership Document / Registered Lease", "Municipal Tax Assessment / Building Permission", "Aadhaar Card of Applicant", "Wiring Contractor Test Report"],
        "procedure": "1. Apply on DISCOM consumer portal. 2. Line feasibility check by Assistant Engineer. 3. Development charges and security deposit payment. 4. Meter fixing and power release.",
        "source_url": "https://power.gov.in",
        "last_reviewed": "2026-08-01",
        "is_verified": True
    },
    {
        "name": "Trade License Issuance and Renewal",
        "category": "Commerce & Municipal",
        "department": "Urban Local Body (ULB) Health & Sanitation Wing",
        "description": "Statutory permission to operate a commercial establishment or food business within municipal limits.",
        "eligibility": "Proprietor, partner, or director of the commercial entity.",
        "required_documents": ["Rental Agreement / Title Deed of Shop", "ID Proof of Proprietor", "NOC from Fire Services (if hazardous/commercial >500sqm)", "Partnership Deed / Incorporation Certificate"],
        "procedure": "1. Online filing of trade category and square footage. 2. Sanitary Inspector premises audit. 3. Municipal fee payment. 4. Trade License issued instantly online.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-05-18",
        "is_verified": True
    },
    {
        "name": "Old Age Pension Scheme (NSAP / Social Welfare)",
        "category": "Social Welfare",
        "department": "Department of Social Welfare & Panchayat Raj",
        "description": "Monthly direct benefit social security pension for destitute and senior citizens.",
        "eligibility": "Citizens aged 60 years or above living below the state poverty line.",
        "required_documents": ["Aadhaar Card with verified Age", "Bank Account Passbook (Aadhaar linked)", "White Ration Card (BPL Proof)", "Non-employment certificate"],
        "procedure": "1. Ward or Gram Panchayat volunteer verification. 2. Medical officer age assessment if birth proof absent. 3. Social Audit scrutiny. 4. Monthly direct bank transfer (DBT).",
        "source_url": "https://nsap.nic.in",
        "last_reviewed": "2026-06-25",
        "is_verified": True
    },
    {
        "name": "Building Permission and Plan Approval",
        "category": "Municipal Services",
        "department": "Urban Development Authority / Town Planning",
        "description": "Formal sanction for construction or modification of residential buildings.",
        "eligibility": "Registered owner of freehold residential or commercial plot.",
        "required_documents": ["Sale Deed and Link Documents (30 years)", "Licensed Architect Building Blueprint", "Structural Stability Certificate", "Latest Property Tax & Encumbrance Certificate"],
        "procedure": "1. Architect submits drawing through Online Building Permission System (OBPS). 2. Automatic scrutiny of setbacks and bylaws. 3. Town planner site visit. 4. Fee payment and digitally signed permit.",
        "source_url": "https://mohua.gov.in",
        "last_reviewed": "2026-09-05",
        "is_verified": True
    },
    {
        "name": "Disability Certificate and UDID Card",
        "category": "Social Welfare & Health",
        "department": "Department of Empowerment of Persons with Disabilities",
        "description": "Assessment and issuance of permanent Unique Disability ID card granting access to government concessions.",
        "eligibility": "Persons with benchmark disability of 40% or higher as certified by medical board.",
        "required_documents": ["Passport size photographs showing disability", "Aadhaar Card / ID Proof", "Previous hospital discharge reports or diagnostic papers"],
        "procedure": "1. Register on Swavlamban portal. 2. Medical examination at District Headquarter Hospital. 3. Assessment by specialist board. 4. Generation of national UDID card.",
        "source_url": "https://www.swavlambancard.gov.in",
        "last_reviewed": "2026-07-10",
        "is_verified": True
    },
    {
        "name": "Issuance of Encumbrance Certificate (EC)",
        "category": "Revenue & Property",
        "department": "Registration and Stamps Department",
        "description": "Official verification certifying whether a property is free from legal liabilities, mortgages, or liens.",
        "eligibility": "Any citizen searching property transaction records.",
        "required_documents": ["Property Details (Survey Number, House Number, Boundaries)", "Applicant Aadhaar Card", "Prior Document Number (if available)"],
        "procedure": "1. Enter district, mandal, and survey details. 2. Select search period (e.g., past 30 years). 3. Pay portal fee. 4. Download signed Encumbrance Certificate immediately.",
        "source_url": "https://igrsup.gov.in",
        "last_reviewed": "2026-08-28",
        "is_verified": True
    },
    {
        "name": "Street Light Repair and High-Mast Maintenance",
        "category": "Municipal Services",
        "department": "Municipal Electrical Wing",
        "description": "Complaint redressal regarding non-functioning street lamps, damaged poles, or loose electric cables.",
        "eligibility": "All residents residing within the municipal corporation boundaries.",
        "required_documents": ["Pole identification number (if tagged)", "Exact colony/street landmark"],
        "procedure": "1. Citizen logs grievance through portal with location and landmark. 2. Ticket dispatched to division electrical supervisor. 3. Repair van replaces LED ballast or wiring within 48 hours. 4. Resolution confirmed with photo upload.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-10-01",
        "is_verified": True
    }
]

KNOWLEDGE_DOCS_DATA = [
    {
        "title": "How to track a submitted grievance on the portal?",
        "category": "Portal Guidance",
        "department": "Public Grievance Redressal Cell",
        "content": "To track your grievance, log into your citizen dashboard and navigate to 'My Grievances' or use the 'Track Grievance' search bar with your unique reference number (e.g. GRV-YYYYMMDD-XXXX). You can view the current stage, timestamps, administrative remarks, and department actions.",
        "source_url": "https://pgportal.gov.in",
        "last_reviewed": "2026-10-01"
    },
    {
        "title": "What are the allowed stages of a public grievance?",
        "category": "Portal Guidance",
        "department": "Public Grievance Redressal Cell",
        "content": "Public grievances transition through 5 distinct statuses: 1. 'Submitted' (registered in system), 2. 'Under Review' (assigned to concerned department officer), 3. 'In Progress' (field inspection or repair underway), 4. 'Resolved' (action completed with remarks), and 5. 'Rejected' (outside jurisdiction or duplicate with reason).",
        "source_url": "https://pgportal.gov.in",
        "last_reviewed": "2026-10-01"
    },
    {
        "title": "What is the timeline for resolving municipal drinking water complaints?",
        "category": "Citizen Charter",
        "department": "Water Supply and Sewerage Board",
        "content": "According to the Citizen Charter, pipeline leakage complaints must be inspected within 24 hours and repaired within 48 hours. Contaminated water supply reports must receive immediate emergency water tankers and laboratory water testing within 12 hours.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-09-15"
    },
    {
        "title": "Can an unverified public service still be applied for online?",
        "category": "Public Information",
        "department": "Administrative Reforms",
        "content": "Services tagged with 'Sample Data' or 'Unverified' are synthetic entries used for academic prototype demonstration under problem statement HACK-P438. Official government applications must be submitted strictly through verified departmental portals.",
        "source_url": "https://india.gov.in",
        "last_reviewed": "2026-10-20"
    },
    {
        "title": "What documents are required for a Birth Certificate if delayed by over one year?",
        "category": "Civil Registration",
        "department": "Revenue and Municipal Administration",
        "content": "If birth registration is delayed beyond 1 year, an order from the Revenue Divisional Officer (RDO) or Executive Magistrate is mandatory, accompanied by a non-availability certificate from the municipality, parent affidavits, and school records.",
        "source_url": "https://crsorgi.gov.in",
        "last_reviewed": "2026-08-15"
    },
    {
        "title": "How to resolve erroneous electricity bills?",
        "category": "Energy & Utilities",
        "department": "State Electricity Distribution Company",
        "content": "For erroneous or astronomical power bills, lodge a complaint under category 'Electricity' citing your 10-digit Consumer Unique Service Number (USC). Attach a photo of the physical meter display. The meter inspector is mandated to recalibrate the meter within 7 working days.",
        "source_url": "https://power.gov.in",
        "last_reviewed": "2026-08-01"
    },
    {
        "title": "Who is eligible for the BPL Ration Card?",
        "category": "Civil Supplies",
        "department": "Civil Supplies Department",
        "content": "Families with total annual household income below Rs. 1,50,000 in rural areas and Rs. 2,00,000 in urban areas, possessing less than 3.5 acres of wet land or 7.5 acres of dry land, and not paying income tax are eligible for Priority Household (BPL) ration cards.",
        "source_url": "https://nfsa.gov.in",
        "last_reviewed": "2026-08-10"
    },
    {
        "title": "What should I do if garbage is not cleared in my neighborhood?",
        "category": "Sanitation",
        "department": "Municipal Health and Sanitation Wing",
        "content": "Submit a grievance under 'Sanitation' stating the exact locality, street name, and prominent landmark. You can optionally upload a photograph showing the accumulation. The sanitary supervisor must deploy a dumper placer vehicle within 24 hours.",
        "source_url": "https://swachhbharatmission.ddws.gov.in",
        "last_reviewed": "2026-09-20"
    },
    {
        "title": "How is a Learner's License driving test conducted?",
        "category": "Transport",
        "department": "Regional Transport Office (RTO)",
        "content": "The Learner's Test consists of 20 multiple-choice questions on road traffic signs, defensive driving rules, and driver duties. Scoring at least 12 marks out of 20 is required to qualify. The test can be taken from home with Aadhaar authentication or at the RTO.",
        "source_url": "https://parivahan.gov.in",
        "last_reviewed": "2026-09-12"
    },
    {
        "title": "What is the validity period of an Income Certificate?",
        "category": "Revenue & Property",
        "department": "Revenue Department",
        "content": "An Income Certificate issued by the competent Tahsildar is valid for one financial year from the date of issue for scholarship applications, admission fee waivers, and welfare program eligibility.",
        "source_url": "https://services.india.gov.in",
        "last_reviewed": "2026-06-30"
    },
    {
        "title": "How to report open potholes and damaged road sections?",
        "category": "Roads & Infrastructure",
        "department": "Roads and Buildings (R&B) / Municipal Engineering",
        "content": "Report through the portal under category 'Roads & Infrastructure' with landmark details. Emergency road patching squads are assigned within 72 hours for major arterial roads and within 7 days for colony roads.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-09-01"
    },
    {
        "title": "What is an Encumbrance Certificate (EC) and why is it needed?",
        "category": "Revenue & Property",
        "department": "Registration and Stamps Department",
        "content": "An EC reflects all registered property transactions and encumbrances (mortgages, court attachments, sales) on a parcel of land over a specified timeframe. It is a critical document required for obtaining bank home loans and verifying clean property title.",
        "source_url": "https://igrsup.gov.in",
        "last_reviewed": "2026-08-28"
    },
    {
        "title": "Can an administrative officer reject a citizen complaint without explanation?",
        "category": "Portal Rules",
        "department": "Chief Grievance Redressal Office",
        "content": "No. Under statutory public grievance rules, every status change to 'Rejected' requires the officer to furnish clear written administrative remarks explaining the cause (e.g. sub-judice matter, lack of municipal jurisdiction, or duplicate submission).",
        "source_url": "https://darpg.gov.in",
        "last_reviewed": "2026-10-01"
    },
    {
        "title": "How can senior citizens apply for old age pension assistance?",
        "category": "Social Welfare",
        "department": "Department of Social Welfare",
        "content": "Citizens aged 60 and above can submit an application via their village or ward secretariat with Aadhaar, bank passbook, and white ration card. Following biometric authentication, monthly pension is credited directly to their bank account.",
        "source_url": "https://nsap.nic.in",
        "last_reviewed": "2026-06-25"
    },
    {
        "title": "What are the rules regarding grievance attachments?",
        "category": "Portal Guidance",
        "department": "Public Grievance Redressal Cell",
        "content": "Attachments are optional supporting evidence. The system accepts files in JPEG, PNG, or PDF formats up to a maximum size of 5 megabytes. Uploading clear photos of civic defects significantly expedites field investigation.",
        "source_url": "https://pgportal.gov.in",
        "last_reviewed": "2026-10-15"
    },
    {
        "title": "How to report street light failures in residential sectors?",
        "category": "Municipal Services",
        "department": "Municipal Electrical Wing",
        "content": "Submit a complaint under category 'Municipal' or 'Electricity'. Provide the nearest house number and electrical pole tag number. The maintenance wing replaces faulty LED bulbs and photo-sensors within 48 hours.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-10-01"
    },
    {
        "title": "What is the procedure for obtaining a trade license for retail shops?",
        "category": "Commerce & Municipal",
        "department": "Urban Local Body (ULB)",
        "content": "Retail traders must apply with property tax clearance, tenancy agreement, and photo ID. Standard non-hazardous commercial licenses are auto-approved upon fee payment; food establishments require additional FSSAI certificate.",
        "source_url": "https://serviceonline.gov.in",
        "last_reviewed": "2026-05-18"
    },
    {
        "title": "What constitutes an emergency grievance?",
        "category": "Disaster & Emergency",
        "department": "Emergency Disaster Cell",
        "content": "Live electrical wires hanging loose, sewage flooding into houses, collapsed drainage covers, and sudden pipeline bursts qualify as urgent civic hazards. Immediate alert is triggered to field teams upon lodging.",
        "source_url": "https://ndma.gov.in",
        "last_reviewed": "2026-08-30"
    },
    {
        "title": "How can a citizen contact the administrative officer assigned to their grievance?",
        "category": "Portal Guidance",
        "department": "Public Grievance Redressal Cell",
        "content": "When a complaint enters 'Under Review' or 'In Progress', the officer's administrative designation and status remarks appear on the Grievance Details page. Citizens can also submit follow-up remarks if additional clarification is requested.",
        "source_url": "https://pgportal.gov.in",
        "last_reviewed": "2026-10-01"
    },
    {
        "title": "Is registration mandatory to search public service directory?",
        "category": "Portal Guidance",
        "department": "Citizen Services IT Division",
        "content": "No. The Public Service Directory is open to all visitors without login. You can browse, search by keyword, and inspect eligibility and document checklists. Registration is required only when submitting a grievance or using personalized AI chat history.",
        "source_url": "https://india.gov.in",
        "last_reviewed": "2026-10-01"
    }
]

def seed_admin_user(
    db: Session,
    email: str | None = None,
    password: str | None = None,
    full_name: str | None = None,
) -> User | None:
    """Create the bootstrap administrator when explicit credentials are supplied.

    No default credentials are shipped. If credentials are absent the function
    returns ``None`` so the rest of the reference data can still be seeded.
    """
    admin_email = (email or settings.ADMIN_BOOTSTRAP_EMAIL or "").strip().lower()
    admin_password = password or settings.ADMIN_BOOTSTRAP_PASSWORD or ""
    admin_name = (full_name or settings.ADMIN_BOOTSTRAP_NAME or "System Administrator").strip()

    if not admin_email or not admin_password:
        logger.warning(
            "Skipping admin bootstrap: set ADMIN_BOOTSTRAP_EMAIL and "
            "ADMIN_BOOTSTRAP_PASSWORD (or run scripts/create_admin.py)."
        )
        return None

    if len(admin_password) < 8:
        raise ValueError("Administrator password must be at least 8 characters long")
    if not re.search(r"[A-Za-z]", admin_password) or not re.search(r"\d", admin_password):
        raise ValueError(
            "Administrator password must contain at least one letter and one digit"
        )

    admin_user = db.scalar(select(User).where(User.email == admin_email))
    if admin_user:
        if admin_user.role != "admin":
            # Never escalate an existing citizen account or reset its password.
            logger.error(
                "Refusing to bootstrap admin: %s already exists with role '%s'. "
                "Use a different administrator email.",
                admin_email,
                admin_user.role,
            )
            return None
        logger.info("Administrator %s already exists; preserving the account.", admin_email)
        return admin_user

    admin_user = User(
        email=admin_email,
        full_name=admin_name,
        phone="1800-111-2222",
        password_hash=hash_password(admin_password),
        role="admin",
        is_active=True,
    )
    db.add(admin_user)
    logger.info("Seeded admin user: %s", admin_email)
    return admin_user


def seed_reference_data(db: Session) -> None:
    """Seed the public service directory and curated knowledge documents."""
    existing_services = db.scalars(select(Service)).all()
    if len(existing_services) < 15:
        for s_data in SERVICES_DATA:
            exists = any(s.name == s_data["name"] for s in existing_services)
            if not exists:
                svc = Service(**s_data)
                db.add(svc)
        logger.info("Seeded %s services into database.", len(SERVICES_DATA))

    existing_kd = db.scalars(select(KnowledgeDocument)).all()
    if len(existing_kd) < 20:
        for kd_data in KNOWLEDGE_DOCS_DATA:
            exists = any(k.title == kd_data["title"] for k in existing_kd)
            if not exists:
                doc = KnowledgeDocument(**kd_data)
                db.add(doc)
        logger.info("Seeded %s knowledge documents into database.", len(KNOWLEDGE_DOCS_DATA))


def seed_database(db: Session) -> None:
    """Seed the admin (when configured), service directory and knowledge base."""
    seed_admin_user(db)
    seed_reference_data(db)
    db.commit()

