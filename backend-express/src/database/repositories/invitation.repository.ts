import type { UserType } from "../../generated/prisma/enums.js";
import type { DbClient } from "../client.js";

export class InvitationRepository {
  constructor(private readonly db: DbClient) {}

  findByCode(inviteCode: string) {
    return this.db.invitation.findUnique({
      where: { inviteCode },
      include: { company: { select: { id: true, name: true, isGlobal: true } } },
    });
  }

  // Invitation::updateOrCreate(['email' => ...], [...])
  upsertByEmail(data: {
    name: string;
    email: string;
    inviteCode: string;
    companyId: number;
    role: UserType;
  }) {
    return this.db.invitation.upsert({
      where: { email: data.email },
      create: data,
      update: data,
    });
  }

  // A code can only be used once
  clearCode(id: number) {
    return this.db.invitation.update({ where: { id }, data: { inviteCode: null } });
  }
}
