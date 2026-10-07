<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class AdminShortUrlExport implements FromCollection, WithHeadings
{
    private $urls;

    public function __construct($allUrls)
    {
        $this->urls = collect($allUrls);
    }

    public function headings(): array
    {
        return [
            'Short URL',
            'Long URL',
            'Hits',
            'User',
            'Created On'
        ];
    }

    public function collection()
    {
        return $this->urls->map(function ($url) {
            $createdOn = \Carbon\Carbon::parse($url->created_at)->format('d M Y');

            return [
                $url->short_url_code ?? '',
                $url->url ?? '',
                $url->hits ?? '',
                $url->user ?? '',
                $createdOn,
            ];
        });
    }
}
