import {
  OptionalString,
  Required,
  RequiredEmail,
  RequiredMin,
} from '../../../common/validation/rules.js';
import { SameAs } from '../../../common/validation/same-as.validator.js';

// App\Http\Requests\Invitation\RegisterRequest. company_name is checked in the
// service: it is only required for invitations from the global company.
export class RegisterDto {
  @Required('name')
  name: string;

  @RequiredEmail('email')
  email: string;

  @OptionalString('company_name')
  company_name?: string;

  @RequiredMin('password', 8)
  password: string;

  @SameAs('password')
  @Required('password_confirmation')
  password_confirmation: string;
}
