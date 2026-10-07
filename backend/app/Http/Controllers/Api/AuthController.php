<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\ApiBaseController;
use App\Http\Requests\Api\LoginRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends ApiBaseController
{
    public function login(LoginRequest $request)
    {
        // Attempt login
        if (!Auth::attempt($request->only('email', 'password'))) {
            return $this->error('Invalid credentials', 403);
        }

        // Get authenticated user
        $user = User::select('id', 'name', 'type', 'status', 'company_id')
            ->with('company:id,name')
            ->where('email', $request->email)->first();

        // Create token
        $token = $user->createToken('api-token')->plainTextToken;

        $data = [
            'user' => $user,
            'token' => $token
        ];

        return $this->success('Login successful', $data);
    }

    public function user(Request $request)
    {
        $user = User::select('id', 'name', 'type', 'status', 'company_id')
            ->with('company:id,name')
            ->where('id', $request->user()->id)
            ->first();

        $data = [
            'user' => $user
        ];

        return $this->success('User Fetched successfully', $data);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->success('Logged out successfully');
    }
}
