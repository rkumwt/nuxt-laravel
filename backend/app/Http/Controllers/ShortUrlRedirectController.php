<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\ShortUrl;
use App\Models\User;
use Illuminate\Http\Request;

class ShortUrlRedirectController extends Controller
{
    public function redirect($code)
    {
        $shortUrl = ShortUrl::where('short_url_code', $code)->first();

        if (!$shortUrl) {
            abort(404, 'Short URL not found');
        }

        // Increment hits for short_url
        $shortUrl->increment('hits');

        // Increment total_url_hits for company
        Company::where('id', $shortUrl->company_id)->increment('total_url_hits');

        // Increment total_url_hits for user
        User::where('id', $shortUrl->created_by)->increment('total_url_hits');

        // Redirect to original URL
        return redirect($shortUrl->url);
    }
}
