<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;

class ClientSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('users')->truncate();
        Schema::enableForeignKeyConstraints();

        // Creating superadmin user
        $globalCompany = Company::where('is_global', 1)->first();
        $superadminUser = new User();
        $superadminUser->company_id = $globalCompany->id;
        $superadminUser->name = 'Sembark';
        $superadminUser->email = 'superadmin@example.com';
        $superadminUser->password = Hash::make(12345678);
        $superadminUser->type = 'superadmin';
        $superadminUser->status = 'enabled';
        $superadminUser->save();

        if (env('APP_ENV') === "local") {
            // Admin for Demo Company
            $demoCompany = Company::where('is_global', 0)->first();
            $admin = new User();
            $admin->company_id = $demoCompany->id;
            $admin->name = 'Admin';
            $admin->email = 'admin@example.com';
            $admin->password = Hash::make(12345678);
            $admin->status = 'enabled';
            $admin->save();

            // Member for Demo Company
            $admin = new User();
            $admin->company_id = $demoCompany->id;
            $admin->name = 'Member';
            $admin->email = 'member@example.com';
            $admin->password = Hash::make(12345678);
            $admin->status = 'enabled';
            $admin->type = 'member';
            $admin->save();

            // Creating Random users for
            $companies = Company::where('is_global', 0)->inRandomOrder()->get();
            foreach ($companies as $company) {
                User::factory()->count(1)->create([
                    'company_id' => $company->id,
                    'status' => 'enabled',
                    'type' => 'admin'
                ]);

                User::factory()->count(fake()->numberBetween(2, 5))->create([
                    'company_id' => $company->id,
                    'status' => 'enabled',
                    'type' => fake()->randomElement(['admin', 'member'])
                ]);
            }
        }
    }
}
