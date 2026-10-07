<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class CompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('companies')->truncate();
        Schema::enableForeignKeyConstraints();

        // Creating superadmin company
        $superadminCompany = new Company();
        $superadminCompany->name = 'Sembark';
        $superadminCompany->email = 'gloablcompany@example.com';
        $superadminCompany->is_global = 1;
        $superadminCompany->save();

        if (env('APP_ENV') === "local") {
            // Creating Admin Company
            $adminCompany = new Company();
            $adminCompany->name = 'Demo Company';
            $adminCompany->email = 'company@example.com';
            $adminCompany->save();

            // Create 200 additional companies using factory
            Company::factory()->count(200)->create();
        }
    }
}
