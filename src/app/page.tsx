import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSession } from "@/lib/auth";
import { getCategories } from "@/lib/category-store";
import { prisma } from "@/lib/db";
import { getGuestLists } from "@/lib/lists";
import { buildAttendanceEventOptions } from "@/lib/list-kinds";
import { toPersonDTO } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const lists = await getGuestLists();
  const categoryCatalog = await getCategories();
  const [people, gameEvents] = await Promise.all([
    prisma.person.findMany({
      include: {
        memberships: true,
        attendances: { include: { event: true } },
        categories: { include: { category: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.gameEvent.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const attendanceEvents = buildAttendanceEventOptions(gameEvents, lists);

  return (
    <Dashboard
      people={people.map(toPersonDTO)}
      lists={lists}
      attendanceEvents={attendanceEvents}
      categories={categoryCatalog}
      userName={session.name}
    />
  );
}
