<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\ApiBaseController;
use App\Http\Requests\Invitation\RegisterRequest;
use App\Models\Company;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class InvitationController extends ApiBaseController
{
    public function invitation(Request $request, $invitationCode)
    {
        $invitation = Invitation::select('name', 'email', 'company_id')
            ->with(['company:id,name,is_global'])
            ->where('invite_code', $invitationCode)
            ->first();

        if (!$invitation) {
            return $this->error('Invitation code not exists');
        }

        $data = [
            'data' => $invitation,
        ];

        return $this->success('Information fetched successfully', $data);
    }

    public function register(RegisterRequest $request, $invitationCode)
    {
        $invitation = Invitation::select('name', 'email', 'company_id', 'role')
            ->with(['company:id,name,is_global'])
            ->where('invite_code', $invitationCode)
            ->first();

        if ($invitation) {
            $isGlobalCompany = $invitation->company->is_global;
            $companyId = $invitation->company->id;

            // If it is global company
            if ($isGlobalCompany) {
                // Creating company
                $company = new Company();
                $company->name = $request->company_name;
                $company->email = $request->email;
                $company->save();

                $companyId = $company->id;
            }

            $user = new User();
            $user->company_id = $companyId;
            $user->name = $request->name;
            $user->email = $request->email;
            $user->password = Hash::make($request->password);
            $user->status = 'enabled';
            $user->type = $invitation->role;
            $user->save();

            // Update total_users for company
            $totalUsers = User::where('company_id', $companyId)->count();
            Company::where('id', $companyId)->update(['total_users' => $totalUsers]);

            // Invalidate invite code
            Invitation::where('invite_code', $invitationCode)->update(['invite_code' => null]);

            return $this->success('Registration completed successfully. Now you can login.');
        } else {
            return $this->error('Invitation not exists');
        }
    }
}
