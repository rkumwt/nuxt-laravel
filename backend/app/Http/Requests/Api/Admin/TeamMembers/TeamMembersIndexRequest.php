<?php

namespace App\Http\Requests\Api\Admin\TeamMembers;

use App\Http\Requests\ApiBaseRequest;

class TeamMembersIndexRequest extends ApiBaseRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->type === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [];
    }
}
