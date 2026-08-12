import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGuestLists } from "@/lib/lists";
import { toPersonDTO } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const lists = await getGuestLists();
  const people = await prisma.person.findMany({
    include: {
      memberships: true,
      attendances: { include: { event: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return (
    <Dashboard
      people={people.map(toPersonDTO)}
      lists={lists}
      userName={session.name}
    />
  );
}
