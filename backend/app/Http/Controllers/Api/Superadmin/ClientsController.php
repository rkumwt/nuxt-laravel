<?php

namespace App\Http\Controllers\Api\Superadmin;

use App\Http\Controllers\ApiBaseController;
use App\Http\Requests\Api\Superadmin\Clients\ClientsIndexRequest;
use App\Http\Requests\Api\Superadmin\Clients\ClientsInviteRequest;
use App\Mail\InviteMailClient;
use App\Models\Company;
use App\Models\Invitation;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ClientsController extends ApiBaseController
{
    public function index(ClientsIndexRequest $request)
    {
        $perPage = $request->per_page ?? 10;

        $users = Company::select('id', 'name', 'email', 'total_users', 'total_urls', 'total_url_hits')
            ->where('is_global', 0)
            ->paginate($perPage);

        return $this->success('Clients fetched successfully', [
            'data'   => $users->items(),
            'meta'      => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total()
            ]
        ]);
    }

    public function invite(ClientsInviteRequest $request)
    {
        $name = $request->name;
        $email = $request->email;
        $globalCompany = Company::select('id', 'name')->where('is_global', 1)->first();
        $globalCompanyName = $globalCompany ? $globalCompany->name : '';
        $inviteCode = Str::random(6);

        Invitation::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'email' => $email,
                'invite_code' => $inviteCode,
                'company_id'  => $globalCompany->id,
                'role'  => 'admin'
            ]
        );

        $inviteUrl = rtrim(config('app.frontend_url'), '/') . '/invite/' . $inviteCode;

        try {
            Mail::to($email)->send(new InviteMailClient($name, $globalCompanyName, $inviteUrl));
        } catch (\Exception) {
            return $this->error('Failed to send invitation email. Please check mail configuration.', 403);
        }

        return $this->success('Invitation send successfully');
    }
}
