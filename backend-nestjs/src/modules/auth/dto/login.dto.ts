import { Required, RequiredEmail } from '../../../common/validation/rules.js';

// App\Http\Requests\Api\LoginRequest
export class LoginDto {
  @RequiredEmail('email')
  email: string;

  @Required('password')
  password: string;
}
