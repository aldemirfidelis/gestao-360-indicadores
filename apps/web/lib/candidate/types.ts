/** Tipos do portal do candidato (`/candidato`), compartilhados pelas seções. */

export interface CandidateExperience { role: string; company: string; period: string; description: string }
export interface CandidateEducation { course: string; institution: string; period: string; status: string }
export interface CandidateLanguage { name: string; level: string }

export interface CandidateProfileData {
  about?: string;
  availableForRelocation?: boolean;
  availableForTravel?: boolean;
  desiredSalary?: string;
  availabilityToStart?: string;
  skills?: string[];
  experiences?: Partial<CandidateExperience>[];
  education?: Partial<CandidateEducation>[];
  languages?: Partial<CandidateLanguage>[];
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  headline: string | null;
  city: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  profileData: CandidateProfileData | null;
  emailVerifiedAt: string | null;
}

export interface ProfileForm {
  name: string;
  phone: string;
  headline: string;
  city: string;
  linkedinUrl: string;
  portfolioUrl: string;
}

export interface ProfessionalForm {
  about: string;
  availableForRelocation: boolean;
  availableForTravel: boolean;
  desiredSalary: string;
  availabilityToStart: string;
  skills: string;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  languages: CandidateLanguage[];
}

export interface Application {
  id: string;
  status: string;
  appliedAt: string;
  stage: string | null;
  posting: {
    title: string;
    slug: string;
    city: string | null;
    workMode: string | null;
    company: { name: string; slug: string | null } | null;
  };
  rejectionReason: string | null;
}

export interface CandidateDocument {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  applicationId: string | null;
  createdAt: string;
}

export interface DataRequest {
  id: string;
  type: string;
  status: string;
  details: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface StoredContent { fileName: string; mimeType: string; contentBase64: string }

export interface Offer {
  id: string;
  status: string;
  revision: number;
  salaryAmountCents: number;
  currency: string;
  startDate: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  application: { posting: { title: string; slug: string; city: string | null; workMode: string | null } };
}

export interface PreAdmissionDocument {
  id: string;
  kind: string;
  title: string;
  required: boolean;
  status: string;
  reviewNote: string | null;
  candidateDocumentId: string | null;
  candidateDocument?: { fileName: string; sizeBytes: number } | null;
}

export interface OccupationalAppointment {
  id: string;
  status: string;
  scheduledAt: string;
  location: string | null;
  providerName: string | null;
  instructions: string | null;
}

export interface AsoRecord { id: string; result: string; examDate: string; validUntil: string | null }

export interface OccupationalExamRequest {
  id: string;
  status: string;
  examType: string;
  dueAt: string | null;
  requestedAt: string;
  appointment?: OccupationalAppointment | null;
  asoRecord?: AsoRecord | null;
}

export interface PreAdmission {
  id: string;
  status: string;
  admissionTargetDate: string | null;
  application: { posting: { title: string; slug: string } };
  documents: PreAdmissionDocument[];
  occupationalExamRequests?: OccupationalExamRequest[];
}

/** Tudo que o portal carrega de uma vez — usado pelo resumo da tela inicial. */
export interface PortalData {
  profile: Profile | null;
  applications: Application[];
  documents: CandidateDocument[];
  dataRequests: DataRequest[];
  offers: Offer[];
  preAdmissions: PreAdmission[];
}

export const EMPTY_EXPERIENCE: CandidateExperience = { role: '', company: '', period: '', description: '' };
export const EMPTY_EDUCATION: CandidateEducation = { course: '', institution: '', period: '', status: '' };
export const EMPTY_LANGUAGE: CandidateLanguage = { name: '', level: '' };
export const EMPTY_PROFESSIONAL_FORM: ProfessionalForm = {
  about: '',
  availableForRelocation: false,
  availableForTravel: false,
  desiredSalary: '',
  availabilityToStart: '',
  skills: '',
  experiences: [],
  education: [],
  languages: [],
};
