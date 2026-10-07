<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ShortUrl;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class ShortUrlsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('short_urls')->truncate();
        Schema::enableForeignKeyConstraints();

        // Seed data always for demo company
        $demoCompany = Company::where('email', 'company@example.com')->first();
        $users = User::where('company_id', $demoCompany->id)->inRandomOrder()->limit(5)->get();
        foreach ($users as $user) {
            $userId = $user->id;

            ShortUrl::factory()
                ->count(50)
                ->create([
                    'company_id' => $demoCompany->id,
                    'created_by' => $userId,
                ]);
        }

        // Also seeding data for user type member
        $memberUser = User::where('company_id', $demoCompany->id)->where('email', 'member@example.com')->first();
        ShortUrl::factory()
            ->count(35)
            ->create([
                'company_id' => $demoCompany->id,
                'created_by' => $memberUser,
            ]);

        // Get some more other companies other than demo
        $otherCompanies = Company::where('is_global', 0)
            ->where('id', '!=', $demoCompany->id)
            ->inRandomOrder()
            ->limit(fake()->numberBetween(5, 15))
            ->get();

        foreach ($otherCompanies as $otherCompany) {
            $users = User::where('company_id', $otherCompany->id)->inRandomOrder()->limit(5)->get();

            foreach ($users as $user) {
                $userId = $user->id;
                ShortUrl::factory()
                    ->count(50)
                    ->create([
                        'company_id' => $otherCompany->id,
                        'created_by' => $userId,
                    ]);
            }
        }

        // Update company totals
        $companies = Company::where('is_global', 0)->get();

        foreach ($companies as $company) {
            $totalUrls = ShortUrl::where('company_id', $company->id)->count();
            $totalUrlHits = ShortUrl::where('company_id', $company->id)->sum('hits');
            $totalUsers = User::where('company_id', $company->id)->count();

            $company->update([
                'total_urls' => $totalUrls,
                'total_url_hits' => $totalUrlHits,
                'total_users' => $totalUsers,
            ]);
        }

        // Update user totals
        $allUsers = User::all();

        foreach ($allUsers as $user) {
            $totalUrls = ShortUrl::where('created_by', $user->id)->count();
            $totalUrlHits = ShortUrl::where('created_by', $user->id)->sum('hits');

            $user->update([
                'total_urls' => $totalUrls,
                'total_url_hits' => $totalUrlHits,
            ]);
        }
    }
}
