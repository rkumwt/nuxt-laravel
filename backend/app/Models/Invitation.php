<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    protected $fillable = [
        'name',
        'email',
        'invite_code',
        'company_id',
        'role'
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
