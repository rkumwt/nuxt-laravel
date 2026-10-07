<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\AdminShortUrlExport;
use App\Http\Controllers\ApiBaseController;
use App\Http\Requests\Api\Admin\ShortUrls\ShortUrlsDownloadRequest;
use App\Http\Requests\Api\Admin\ShortUrls\ShortUrlsGenerateRequest;
use App\Http\Requests\Api\Admin\ShortUrls\ShortUrlsIndexRequest;
use App\Models\Company;
use App\Models\ShortUrl;
use App\Models\User;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class ShortUrlsController extends ApiBaseController
{
    public function index(ShortUrlsIndexRequest $request)
    {
        $user = $request->user();
        $perPage = $request->per_page ?? 10;
        $startDate = $request->start_date ?? null;
        $endDate = $request->end_date ?? null;

        $urls = ShortUrl::select('short_urls.id', 'short_urls.url', 'short_urls.short_url_code', 'short_urls.hits', 'users.name as user', 'companies.id as client_id', 'short_urls.created_at')
            ->join('users', 'users.id', '=', 'short_urls.created_by')
            ->join('companies', 'companies.id', '=', 'users.company_id')
            ->where('short_urls.company_id', $user->company_id);

        if ($user->type === 'member') {
            $urls->where('short_urls.created_by', $user->id);
        }

        if ($startDate && $endDate) {
            $urls->whereBetween('short_urls.created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        }

        $urls = $urls->orderBy('short_urls.created_at', 'desc')->paginate($perPage);

        return $this->success('Short Urls fetched successfully', [
            'data'   => $urls->items(),
            'meta'      => [
                'current_page' => $urls->currentPage(),
                'last_page' => $urls->lastPage(),
                'per_page' => $urls->perPage(),
                'total' => $urls->total()
            ]
        ]);
    }

    public function download(ShortUrlsDownloadRequest $request)
    {
        $user = $request->user();
        $startDate = $request->start_date ?? null;
        $endDate = $request->end_date ?? null;

        $urls = ShortUrl::select('short_urls.id', 'short_urls.url', 'short_urls.short_url_code', 'short_urls.hits', 'users.name as user', 'short_urls.created_at')
            ->join('users', 'users.id', '=', 'short_urls.created_by')
            ->join('companies', 'companies.id', '=', 'users.company_id')
            ->where('short_urls.company_id', $user->company_id);

        if ($user->type === 'member') {
            $urls->where('short_urls.created_by', $user->id);
        }

        if ($startDate && $endDate) {
            $urls->whereBetween('short_urls.created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        }

        $urls = $urls->orderBy('short_urls.created_at', 'desc')->get();

        return Excel::download(new AdminShortUrlExport($urls), 'urls.csv');
    }

    public function generate(ShortUrlsGenerateRequest $request)
    {
        $user = $request->user();

        // Generate unique short URL code
        do {
            $code = Str::random(6);
        } while (ShortUrl::where('short_url_code', $code)->exists());

        $shortUrl = new ShortUrl();
        $shortUrl->company_id = $user->company_id;
        $shortUrl->url = $request->url;
        $shortUrl->short_url_code = $code;
        $shortUrl->created_by = $user->id;
        $shortUrl->save();

        $userTotalUrls = ShortUrl::where('created_by', $user->id)->count();
        $companyTotalUrls = ShortUrl::where('company_id', $user->company_id)->count();

        Company::where('id', $user->company_id)->update(['total_urls' => $companyTotalUrls]);
        User::where('id', $user->id)->update(['total_urls' => $userTotalUrls]);

        return $this->success('Short URL generated successfully');
    }
}
