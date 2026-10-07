<?php

namespace App\Http\Requests\Api\Superadmin\ShortUrls;

use App\Http\Requests\ApiBaseRequest;

class ShortUrlsIndexRequest extends ApiBaseRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->type === 'superadmin';
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
