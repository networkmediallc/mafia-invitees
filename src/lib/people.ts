import type {
  Person,
  ListMembership,
  EventAttendance,
  GameEvent,
} from "@/generated/prisma/client";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

export type MembershipDTO = {
  listId: string;
  rank: number | null;
};

export type AttendanceDTO = {
  eventId: string;
  eventName: string;
  eventSortOrder: number;
  status: string;
};

export type PersonDTO = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  plusOnes: string | null;
  notes: string | null;
  whoIsThis: string | null;
  groupTags: string | null;
  attended: string | null;
  previousPlayer: boolean;
  sent: string | null;
  onQuickList: boolean;
  quickRank: number | null;
  onVegas: boolean;
  vegasRank: number | null;
  onFormer: boolean;
  formerRank: number | null;
  event1Rsvp: string | null;
  event2Rsvp: string | null;
  event3Rsvp: string | null;
  upcomingInviteStatus: string;
  upcomingInvitedOn: string | null;
  upcomingInviteEventId: string | null;
  archived: boolean;
  archivedAt: string | null;
  lastEditedBy: string | null;
  updatedAt: string;
  memberships: MembershipDTO[];
  attendances: AttendanceDTO[];
} & Record<CategoryKey, boolean>;

type PersonWithRelations = Person & {
  memberships?: Pick<ListMembership, "listId" | "rank">[];
  attendances?: (Pick<EventAttendance, "eventId" | "status"> & {
    event?: Pick<GameEvent, "name" | "sortOrder">;
  })[];
};

export function toPersonDTO(person: PersonWithRelations): PersonDTO {
  const { memberships, attendances, updatedAt, ...rest } = person;
  return {
    ...rest,
    groupTags: rest.groupTags ?? null,
    updatedAt: updatedAt.toISOString(),
    memberships: (memberships ?? []).map((m) => ({
      listId: m.listId,
      rank: m.rank,
    })),
    attendances: (attendances ?? [])
      .map((a) => ({
        eventId: a.eventId,
        eventName: a.event?.name ?? "Event",
        eventSortOrder: a.event?.sortOrder ?? 0,
        status: a.status,
      }))
      .sort((a, b) => a.eventSortOrder - b.eventSortOrder),
  };
}

export const ATTENDANCE_STATUSES = [
  { value: "attended", label: "Attended" },
  { value: "did_not_attend", label: "Did not attend" },
  { value: "not_on_mailing_list", label: "Wasn't Invited" },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["value"];

export type AttendanceEventOption = {
  /** GameEvent id when already linked; null until first save for a past GuestList */
  id: string | null;
  guestListId?: string | null;
  name: string;
  slug: string;
  sortOrder: number;
};

export function attendanceLabel(status: string) {
  const found = ATTENDANCE_STATUSES.find((s) => s.value === status);
  return found?.label ?? status;
}

export function attendanceSummaryFromStatuses(statuses: string[]) {
  if (statuses.includes("attended")) {
    return { attended: "Yes", previousPlayer: true };
  }
  if (statuses.includes("did_not_attend")) {
    return { attended: "No", previousPlayer: false };
  }
  return { attended: null as string | null, previousPlayer: false };
}

export function personCategories(person: Pick<PersonDTO, CategoryKey>) {
  return CATEGORIES.filter((c) => person[c.key]).map((c) => ({
    key: c.key,
    label: c.label,
  }));
}

export function displayName(person: Pick<PersonDTO, "firstName" | "lastName">) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function membershipForList(person: PersonDTO, listId: string) {
  return person.memberships.find((m) => m.listId === listId);
}
