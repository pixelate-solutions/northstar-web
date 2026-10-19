import type {
  AiApproval,
  AiConversation,
  AiMessage,
  Reservation,
  TravelerProfile,
} from "@/db/schema";

export type AiCard =
  | {
      type: "recommendation";
      title: string;
      category: string;
      description?: string | null;
      subtitle?: string | null;
      imageUrl?: string | null;
      href?: string | null;
      priceLabel?: string | null;
      ratingLabel?: string | null;
      badges?: string[];
    }
  | {
      type: "mutation";
      title: string;
      description?: string | null;
      changes: string[];
    }
  | {
      type: "approval";
      approvalId: number;
      approvalType: string;
      title: string;
      description: string;
      actionLabel: string;
      provider?: string | null;
      externalUrl?: string | null;
    }
  | {
      type: "reservation";
      title: string;
      category: string;
      subtitle?: string | null;
      status?: string | null;
      dateLabel?: string | null;
      confirmationCode?: string | null;
    };

export interface AiMessagePayload {
  id: number;
  role: "user" | "assistant";
  content: string;
  cards: AiCard[];
  followups: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
}

export interface AiUploadedFile {
  fileId?: string;
  fileData?: string;
  filename: string;
  mimeType: string;
  bytes: number;
  /** Images go to the model as images; everything else as a document. */
  kind?: "image" | "file";
}


export interface AiChatResponse {
  conversation: AiConversationSummary;
  message: AiMessagePayload;
}

export interface AiApprovalPayload {
  id: number;
  approvalType: string;
  status: string;
  title: string;
  description: string;
  externalUrl: string | null;
}

export interface AiTripContext {
  trip: {
    id: number;
    name: string;
    destination: string | null;
    summary: string | null;
    coverImageUrl: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  days: Array<{
    id: number;
    date: string;
    dayNumber: number;
    title: string;
    location: string;
    sleepLocation: string | null;
    driveInfo: string | null;
    notes: string | null;
    coverImageUrl: string | null;
    events: Array<{
      id: number;
      title: string;
      startTime: string | null;
      endTime: string | null;
      category: string;
      description: string | null;
      location: string | null;
      lat: string | null;
      lng: string | null;
      tip: string | null;
      cost: string | null;
      isBooked: boolean | null;
      sortOrder: number | null;
    }>;
    locations: Array<{
      id: number;
      name: string;
      type: string;
      lat: string;
      lng: string;
      description: string | null;
      imageUrl: string | null;
      tip: string | null;
      googleMapsUrl: string | null;
    }>;
  }>;
  expenses: Array<{
    id: number;
    category: string;
    description: string;
    amount: string;
    isBooked: boolean | null;
    isPaid: boolean | null;
    purchaseDate: string | null;
    notes: string | null;
  }>;
  packingItems: Array<{
    id: number;
    category: string;
    name: string;
    quantity: number | null;
    isPacked: boolean | null;
    isEssential: boolean | null;
    daySpecific: number | null;
    notes: string | null;
  }>;
  reminders: Array<{
    id: number;
    title: string;
    body: string | null;
    dueDate: string | null;
    priority: string;
    isDone: boolean | null;
    dayId: number | null;
  }>;
  reservations: Array<{
    id: number;
    title: string;
    category: string;
    source: string;
    providerName: string | null;
    status: string;
    location: string | null;
    confirmationCode: string | null;
    startAt: string | null;
    endAt: string | null;
    timeZone: string | null;
    priceTotal: string | null;
    currency: string | null;
  }>;
  travelerProfiles: Array<{
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    isDefault: boolean;
  }>;
}

export interface ToolExecutionContext {
  conversation: AiConversation;
  userMessage: AiMessage;
  tripContext: AiTripContext;
}

export interface ToolExecutionArtifact {
  output: unknown;
  summary?: string;
  cards?: AiCard[];
  followups?: string[];
  undoable?: boolean;
}

export interface GoogleReservationSyncResult {
  importedCount: number;
  reservations: Reservation[];
}

export function toConversationSummary(conversation: AiConversation): AiConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: (conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt)
      .toISOString(),
  };
}

export function toMessagePayload(
  message: AiMessage & {
    cards: AiCard[];
    followups: string[];
    metadata?: Record<string, unknown> | null;
  }
): AiMessagePayload {
  return {
    id: message.id,
    role: message.role as "user" | "assistant",
    content: message.content,
    cards: message.cards,
    followups: message.followups,
    metadata: message.metadata ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toApprovalPayload(approval: AiApproval): AiApprovalPayload {
  return {
    id: approval.id,
    approvalType: approval.approvalType,
    status: approval.status,
    title: approval.title,
    description: approval.description,
    externalUrl: approval.externalUrl ?? null,
  };
}

export function summarizeTravelerProfile(profile: TravelerProfile) {
  return `${profile.fullName}${profile.email ? ` (${profile.email})` : ""}`;
}
