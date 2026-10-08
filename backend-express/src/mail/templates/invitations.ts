import { escapeHtml } from "../../utils/html.js";
import { invitationLayout } from "./layout.js";

export interface InvitationMailData {
  name: string;
  company: string;
  inviteLink: string;
}

// App\Mail\InviteMailClient + emails/invite_client.blade.php
export const inviteClientMail = ({ name, company, inviteLink }: InvitationMailData) => ({
  subject: `Invitation mail from ${company}`,
  html: invitationLayout(name, "You have been invited to join our platform.", inviteLink),
});

// App\Mail\InviteMailTeamMember + emails/invite_team_member.blade.php
export const inviteTeamMemberMail = ({ name, company, inviteLink }: InvitationMailData) => ({
  subject: `Invitation from ${company}`,
  html: invitationLayout(
    name,
    `You have been invited to join our company <b>${escapeHtml(company)}</b> as a team member.`,
    inviteLink,
  ),
});
