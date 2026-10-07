<?php

namespace App\Http\Requests\Invitation;

use App\Models\Invitation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $invitation = Invitation::select('id', 'company_id')
            ->with(['company:id,is_global'])
            ->where('invite_code', $this->code)
            ->first();

        $rules = [
            'name'  => 'required',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'password_confirmation' => 'required|same:password'
        ];

        if ($invitation && $invitation->company->is_global === 1) {
            $rules['company_name'] = 'required';
        }

        return $rules;
    }
}
