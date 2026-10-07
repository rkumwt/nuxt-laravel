<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShortUrl extends Model
{
    use HasFactory;

    protected $appends = ['short_url'];

    protected $fillable = [
        'company_id',
        'url',
        'short_url_code',
        'hits',
        'created_by',
    ];

    public function getShortUrlAttribute()
    {
        return route('short.redirect', ['code' => $this->short_url_code]);
    }
}
