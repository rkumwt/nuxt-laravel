<?php

namespace App\Http\Controllers\Api\Superadmin;

use App\Exports\ShortUrlExport;
use App\Http\Controllers\ApiBaseController;
use App\Http\Requests\Api\Superadmin\ShortUrls\ShortUrlsDownloadRequest;
use App\Http\Requests\Api\Superadmin\ShortUrls\ShortUrlsIndexRequest;
use App\Models\ShortUrl;
use Maatwebsite\Excel\Facades\Excel;

class ShortUrlsController extends ApiBaseController
{
    public function index(ShortUrlsIndexRequest $request)
    {
        $perPage = $request->per_page ?? 10;
        $companyId = $request->company_id ?? null;
        $startDate = $request->start_date ?? null;
        $endDate = $request->end_date ?? null;

        $urls = ShortUrl::select('short_urls.id', 'short_urls.url', 'short_urls.short_url_code', 'short_urls.hits', 'companies.name as client', 'companies.id as client_id', 'short_urls.created_at')
            ->join('users', 'users.id', '=', 'short_urls.created_by')
            ->join('companies', 'companies.id', '=', 'users.company_id');

        if ($companyId) {
            $urls->where('short_urls.company_id', $companyId);
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
        $companyId = $request->company_id ?? null;
        $startDate = $request->start_date ?? null;
        $endDate = $request->end_date ?? null;

        $urls = ShortUrl::select('short_urls.id', 'short_urls.url', 'short_urls.short_url_code', 'short_urls.hits', 'companies.name as client', 'short_urls.created_at')
            ->join('users', 'users.id', '=', 'short_urls.created_by')
            ->join('companies', 'companies.id', '=', 'users.company_id');

        if ($companyId) {
            $urls->where('short_urls.company_id', $companyId);
        }

        if ($startDate && $endDate) {
            $urls->whereBetween('short_urls.created_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
        }

        $urls = $urls->orderBy('short_urls.created_at', 'desc')->get();

        return Excel::download(new ShortUrlExport($urls), 'urls.csv');
    }
}
