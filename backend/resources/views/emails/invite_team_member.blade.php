<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>Invitation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f8;
            padding: 20px;
        }

        .container {
            max-width: 600px;
            margin: auto;
            background: #ffffff;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
        }

        .button {
            display: inline-block;
            padding: 12px 25px;
            background-color: #4f46e5;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
        }

        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>

<body>

    <div class="container">

        <h2>Hello {{ $name }},</h2>

        <p>You have been invited to join our company <b>{{ $company }}</b> as a team member.</p>

        <p>Click the button below to accept the invitation.</p>

        <a href="{{ $inviteLink }}" class="button">
            Accept Invitation
        </a>

        <p style="margin-top:20px;">
            If the button doesn't work, copy and paste this link in your browser:
        </p>

        <p>
            <a href="{{ $inviteLink }}">{{ $inviteLink }}</a>
        </p>

        <div class="footer">
            <p>If you did not expect this invitation, you can ignore this email.</p>
        </div>

    </div>

</body>

</html>