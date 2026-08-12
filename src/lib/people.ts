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

export function attendanceLabel(status: string) {
  if (status === "attended") return "Attended";
  if (status === "did_not_attend") return "Did not attend";
  if (status === "not_on_mailing_list") return "Wasn't Invited";
  return status;
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
