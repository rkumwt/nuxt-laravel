<?php

namespace App\Http\Requests\Api\Admin\ShortUrls;

use App\Http\Requests\ApiBaseRequest;

class ShortUrlsDownloadRequest extends ApiBaseRequest
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
        return [];
    }
}
