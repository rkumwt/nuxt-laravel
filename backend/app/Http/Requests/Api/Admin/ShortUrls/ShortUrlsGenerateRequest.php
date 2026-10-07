<?php

namespace App\Http\Requests\Api\Admin\ShortUrls;

use App\Http\Requests\ApiBaseRequest;

class ShortUrlsGenerateRequest extends ApiBaseRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->type === 'admin' || $this->user()->type === 'member';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'url' => [
                'required',
                'string',
                'regex:/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/'
            ]
        ];
    }

    public function messages(): array
    {
        return [
            'url.regex' => 'Please enter a valid URL (e.g., https://example.com or www.example.com)'
        ];
    }
}
