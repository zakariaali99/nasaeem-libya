"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Terminal, Key, Shield, AlertTriangle, CheckCircle2, Package } from "lucide-react";

const LANGUAGES = [
    { id: "node", name: "Node.js", langInfo: "TypeScript" },
    { id: "python", name: "Python", langInfo: "Python" },
    { id: "php", name: "PHP", langInfo: "PHP" },
    { id: "csharp", name: "C# .NET", langInfo: "C#" },
    { id: "curl", name: "cURL", langInfo: "Bash" }
];

function PartnerApiDocsContent() {
    const searchParams = useSearchParams();

    // Attempt to load API Key from URL (safe). Do NOT load secret from URL.
    const urlKey = searchParams.get("key");

    const [baseUrl, setBaseUrl] = useState("https://api.yourcommerce.com");
    const [apiKey, setApiKey] = useState(urlKey || "YOUR_API_KEY_ID");
    const [apiSecret, setApiSecret] = useState("YOUR_API_SECRET");
    const [copied, setCopied] = useState("");
    const [activeLanguage, setActiveLanguage] = useState("node");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setBaseUrl(window.location.origin);
        }
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(""), 2000);
    };

    const CodeBlock = ({ code, language, id }: { code: string, language: string, id: string }) => (
        <div dir="ltr" className="relative group rounded-lg bg-zinc-950 border border-zinc-800 my-4 overflow-hidden text-left" style={{ direction: 'ltr', textAlign: 'left' }}>
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                <span className="text-xs font-mono text-zinc-400 capitalize">{language}</span>
                <button
                    onClick={() => copyToClipboard(code, id)}
                    className="text-zinc-400 hover:text-zinc-100 transition-colors"
                    title="Copy to clipboard"
                >
                    {copied === id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <div dir="ltr" style={{ direction: 'ltr', textAlign: 'left' }}>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-300 text-left focus:outline-none" style={{ direction: 'ltr', textAlign: 'left' }}>
                    <code dir="ltr" className="text-left block" style={{ direction: 'ltr', textAlign: 'left' }}>{code}</code>
                </pre>
            </div>
        </div>
    );

    // Dynamic code snippets generator
    const generateCode = (endpoint: string, lang: string) => {
        const secretStr = apiSecret && apiSecret !== 'YOUR_API_SECRET' ? '********' : 'YOUR_API_SECRET';
        const keyStr = apiKey || 'YOUR_API_KEY_ID';

        switch (endpoint) {
            case 'issue':
                if (lang === 'node') return `import { VouchersClient } from 'vouchers-js';

const client = new VouchersClient({
  apiKeyId: '${keyStr}',
  apiSecret: '${secretStr}',
  baseUrl: '${baseUrl}'
});

const response = await client.vouchers.issue({
  amount: 50,
  currency: 'USD'
});

console.log(response.voucher.code); // Store securely`;
                if (lang === 'python') return `from vouchers import VouchersClient
import uuid

client = VouchersClient(
    api_key_id="${keyStr}",
    api_secret="${secretStr}",
    base_url="${baseUrl}"
)

res = client.issue(
    amount=50,
    currency="USD",
    idempotency_key=str(uuid.uuid4())
)

print(res.voucher.code)`;
                if (lang === 'php') return `<?php

use Commerce\\Vouchers\\VouchersClient;

$client = new VouchersClient([
    'api_key_id' => '${keyStr}',
    'api_secret' => '${secretStr}',
    'base_url' => '${baseUrl}'
]);

$response = $client->issue([
    'amount' => 50,
    'currency' => 'USD'
]);

echo $response->voucher->code;`;
                if (lang === 'csharp') return `using Commerce.Vouchers;
using System;

var client = new VouchersClient(
    apiKeyId: "${keyStr}",
    apiSecret: "${secretStr}",
    baseUrl: "${baseUrl}"
);

var response = await client.IssueAsync(new IssueRequest {
    Amount = 50,
    Currency = "USD"
});

Console.WriteLine(response.Voucher.Code);`;
                if (lang === 'curl') return `curl -X POST ${baseUrl}/api/partner/v1/vouchers/issue \\
  -H "X-Api-Key-Id: ${keyStr}" \\
  -H "X-Api-Secret: ${secretStr}" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50,
    "currency": "USD"
  }'`;
                break;

            case 'bulk-issue':
                if (lang === 'node') return `import { VouchersClient } from 'vouchers-js';

const client = new VouchersClient({
  apiKeyId: '${keyStr}',
  apiSecret: '${secretStr}',
  baseUrl: '${baseUrl}'
});

const response = await client.vouchers.bulkIssue({
  amount: 10,
  currency: 'USD',
  count: 100
});

response.vouchers.forEach(v => console.log(v.code));`;
                if (lang === 'python') return `from vouchers import VouchersClient
import uuid

client = VouchersClient(
    api_key_id="${keyStr}",
    api_secret="${secretStr}",
    base_url="${baseUrl}"
)

res = client.bulk_issue(
    amount=10,
    currency="USD",
    count=100,
    idempotency_key=str(uuid.uuid4())
)

for v in res.vouchers:
    print(f"Created: {v.code}")`;
                if (lang === 'php') return `<?php

use Commerce\\Vouchers\\VouchersClient;

$client = new VouchersClient([
    'api_key_id' => '${keyStr}',
    'api_secret' => '${secretStr}',
    'base_url' => '${baseUrl}'
]);

$response = $client->bulkIssue([
    'amount' => 10,
    'currency' => 'USD',
    'count' => 100
]);

foreach ($response->vouchers as $v) {
    echo $v->code . "\\n";
}`;
                if (lang === 'csharp') return `using Commerce.Vouchers;
using System;

var client = new VouchersClient(
    apiKeyId: "${keyStr}",
    apiSecret: "${secretStr}",
    baseUrl: "${baseUrl}"
);

var response = await client.BulkIssueAsync(new BulkIssueRequest {
    Amount = 10,
    Currency = "USD",
    Count = 100
});

foreach (var v in response.Vouchers) {
    Console.WriteLine(v.Code);
}`;
                if (lang === 'curl') return `curl -X POST ${baseUrl}/api/partner/v1/vouchers/bulk-issue \\
  -H "X-Api-Key-Id: ${keyStr}" \\
  -H "X-Api-Secret: ${secretStr}" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 10, "currency": "USD", "count": 100 }'`;
                break;

            case 'void':
                if (lang === 'node') return `import { VouchersClient } from 'vouchers-js';

const client = new VouchersClient({
  apiKeyId: '${keyStr}',
  apiSecret: '${secretStr}',
  baseUrl: '${baseUrl}'
});

await client.vouchers.void('vch_12345uuid');
console.log('Successfully voided!');`;
                if (lang === 'python') return `from vouchers import VouchersClient
import uuid

client = VouchersClient(
    api_key_id="${keyStr}",
    api_secret="${secretStr}",
    base_url="${baseUrl}"
)

client.void_voucher(
    voucher_id="vch_12345uuid",
    idempotency_key=str(uuid.uuid4())
)
print("Successfully voided!")`;
                if (lang === 'php') return `<?php

use Commerce\\Vouchers\\VouchersClient;

$client = new VouchersClient([
    'api_key_id' => '${keyStr}',
    'api_secret' => '${secretStr}',
    'base_url' => '${baseUrl}'
]);

try {
    $client->voidVoucher('vch_12345uuid');
    echo "Successfully voided!";
} catch (Exception $e) {
    echo "Failed to void: " . $e->getMessage();
}`;
                if (lang === 'csharp') return `using Commerce.Vouchers;
using System;

var client = new VouchersClient(
    apiKeyId: "${keyStr}",
    apiSecret: "${secretStr}",
    baseUrl: "${baseUrl}"
);

await client.VoidVoucherAsync("vch_12345uuid");
Console.WriteLine("Successfully voided!");`;
                if (lang === 'curl') return `curl -X POST ${baseUrl}/api/partner/v1/vouchers/void \\
  -H "X-Api-Key-Id: ${keyStr}" \\
  -H "X-Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"voucherId": "vch_12345uuid"}'`;
                break;

            case 'status':
                if (lang === 'node') return `import { VouchersClient } from 'vouchers-js';

const client = new VouchersClient({
  apiKeyId: '${keyStr}',
  apiSecret: '${secretStr}',
  baseUrl: '${baseUrl}'
});

const status = await client.vouchers.getStatus('vch_12345uuid');
console.log(\`Status: \${status.status}\`); // active, redeemed, void`;
                if (lang === 'python') return `from vouchers import VouchersClient

client = VouchersClient(
    api_key_id="${keyStr}",
    api_secret="${secretStr}",
    base_url="${baseUrl}"
)

status = client.get_status("vch_12345uuid")
print(f"Status: {status.status}")`;
                if (lang === 'php') return `<?php

use Commerce\\Vouchers\\VouchersClient;

$client = new VouchersClient([
    'api_key_id' => '${keyStr}',
    'api_secret' => '${secretStr}',
    'base_url' => '${baseUrl}'
]);

$status = $client->getStatus('vch_12345uuid');
echo "Status: " . $status->status;`;
                if (lang === 'csharp') return `using Commerce.Vouchers;
using System;

var client = new VouchersClient(
    apiKeyId: "${keyStr}",
    apiSecret: "${secretStr}",
    baseUrl: "${baseUrl}"
);

var status = await client.GetVoucherStatusAsync("vch_12345uuid");
Console.WriteLine($"Status: {status.Status}");`;
                if (lang === 'curl') return `curl -X GET ${baseUrl}/api/partner/v1/vouchers/vch_12345uuid/status \\
  -H "X-Api-Key-Id: ${keyStr}" \\
  -H "X-Idempotency-Key: $(uuidgen)"`;
                break;
        }
        return '';
    };

    return (
        <div dir="ltr" className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100" style={{ direction: 'ltr', textAlign: 'left' }}>
            {/* Header & Hero */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative overflow-hidden text-left" style={{ direction: 'ltr', textAlign: 'left' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-950 pointer-events-none" />
                <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-sm font-medium mb-6">
                        <Terminal className="w-4 h-4" />
                        Developer API Reference
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-left">
                        Partner Vouchers API
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mb-8 text-left">
                        The fully-featured REST API that enables seamless generation, tracking, and voiding of merchant vouchers directly from your application. Build custom workflows and integrate our commerce platform directly into your native tools.
                    </p>

                    {/* Interactive Config Panel */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm max-w-3xl text-left">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            Interactive Documentation Configuration
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 font-medium">
                            <span className="text-orange-500 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Security Notice:</span>
                            For your security, never share links containing your API secret. Paste your credentials below to safely populate the code examples strictly within your browser layout. They are never transmitted or stored, and remain entirely local to your session.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Base URL</label>
                                <input
                                    type="text"
                                    value={baseUrl}
                                    readOnly
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-500 font-mono text-left"
                                    style={{ direction: 'ltr', textAlign: 'left' }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">API Key ID</label>
                                <input
                                    type="text"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API Key ID"
                                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-left"
                                    style={{ direction: 'ltr', textAlign: 'left' }}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Shared Secret</label>
                                <input
                                    type="password"
                                    value={apiSecret}
                                    onChange={(e) => setApiSecret(e.target.value)}
                                    placeholder="Enter your API Secret"
                                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-left"
                                    style={{ direction: 'ltr', textAlign: 'left' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 text-left" style={{ direction: 'ltr', textAlign: 'left' }}>

                {/* Left Sidebar Nav */}
                <div className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-8 space-y-8 text-left">
                        <div>
                            <h4 className="font-semibold text-sm mb-3">Getting Started</h4>
                            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium list-none p-0">
                                <li><a href="#authentication" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Authentication</a></li>
                                <li><a href="#sdks" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Client SDKs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm mb-3">Vouchers Endpoints</h4>
                            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium list-none p-0">
                                <li><a href="#issue-voucher" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Issue Voucher</a></li>
                                <li><a href="#bulk-issue" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Bulk Issue Vouchers</a></li>
                                <li><a href="#void-voucher" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Void Voucher</a></li>
                                <li><a href="#check-status" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Check Status</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Content */}
                <div className="lg:col-span-9 space-y-20 pb-24 text-left">

                    {/* Authentication */}
                    <section id="authentication" className="scroll-mt-8 text-left">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Key className="w-5 h-5" />
                            </div>
                            <h2 className="text-3xl font-bold">Authentication</h2>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                            The API relies on cryptographic hashing to verify endpoints without passing secrets in plain text over URL forms. You must supply three required headers for all requests:
                        </p>

                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden mb-6">
                            <table className="w-full text-sm text-left" style={{ direction: 'ltr', textAlign: 'left' }}>
                                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-left">Header</th>
                                        <th className="px-6 py-3 font-semibold text-left">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400 font-medium text-left">X-Api-Key-Id</td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-left">Your unique Partner API Account Identifier.</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400 font-medium text-left">X-Api-Secret</td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-left">The hashed cryptographic secret to verify your signature payload. Keep this secure!</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400 font-medium text-left">X-Idempotency-Key</td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-left">A UUID that uniquely maps individual requests to prevent double issuance issues during timeouts.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium text-left">
                                Hint: When generating <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">X-Idempotency-Key</code>, always use a v4 UUID. The SDKs handle this automatically for you.
                            </p>
                        </div>
                    </section>

                    {/* SDKs Section */}
                    <section id="sdks" className="scroll-mt-8 text-left">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Package className="w-5 h-5" />
                            </div>
                            <h2 className="text-3xl font-bold">Official Client SDKs</h2>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                            For rapid development, we maintain native client libraries for modern languages. These libraries automatically handle Idempotency logic, Cryptographic signing, API request lifecycle, and Native Types.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* TypeScript / JS */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl relative hover:border-indigo-500/50 transition-colors text-left">
                                <div className="absolute top-6 right-6 text-yellow-500 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded text-xs">JS / TS</div>
                                <h3 className="text-lg font-bold mb-2">Node.js Library</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 h-10">Fully typed native typescript client for Node and Edge devices.</p>
                                <CodeBlock
                                    code={`npm install vouchers-js`}
                                    language="bash"
                                    id="sdk-js"
                                />
                            </div>

                            {/* Python */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl relative hover:border-indigo-500/50 transition-colors text-left">
                                <div className="absolute top-6 right-6 text-blue-500 font-bold bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-xs">Python</div>
                                <h3 className="text-lg font-bold mb-2">Python SDK</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 h-10">Python 3.7+ async/sync wrappers with data class support.</p>
                                <CodeBlock
                                    code={`pip install vouchers-python`}
                                    language="bash"
                                    id="sdk-py"
                                />
                            </div>

                            {/* PHP */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl relative hover:border-indigo-500/50 transition-colors text-left">
                                <div className="absolute top-6 right-6 text-purple-500 font-bold bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-xs">PHP</div>
                                <h3 className="text-lg font-bold mb-2">PHP Library</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 h-10">PSR-compliant classes with Laravel automatic service bindings.</p>
                                <CodeBlock
                                    code={`composer require techwave/commerce-vouchers-php`}
                                    language="bash"
                                    id="sdk-php"
                                />
                            </div>

                            {/* .NET */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl relative hover:border-indigo-500/50 transition-colors text-left">
                                <div className="absolute top-6 right-6 text-indigo-500 font-bold bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded text-xs">.NET</div>
                                <h3 className="text-lg font-bold mb-2">.NET NuGet</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 h-10">C# asynchronous API interface targeting modern dotnet 8+ setups.</p>
                                <CodeBlock
                                    code={`dotnet add package Commerce.Vouchers`}
                                    language="bash"
                                    id="sdk-net"
                                />
                            </div>
                        </div>
                    </section>

                    <hr className="border-zinc-200 dark:border-zinc-800 my-16" />

                    {/* API Endpoints */}
                    <div className="space-y-24">

                        {/* 1. Issue Voucher */}
                        <section id="issue-voucher" className="scroll-mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12 text-left">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">POST</span>
                                    <h3 className="text-2xl font-bold">Issue Voucher</h3>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-mono text-sm bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-left">
                                    {`/api/partner/v1/vouchers/issue`}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed text-left">
                                    Issues a single voucher to the defined campaign. Optionally inherits from standard campaigns if one is not specifically mapped.
                                </p>

                                <h4 className="font-semibold mb-3 text-left">Body Parameters</h4>
                                <ul className="space-y-4 text-sm mb-6 list-none p-0">
                                    <li className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-left">
                                        <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400 min-w-24">amount<span className="text-red-500 ml-1">*</span></div>
                                        <div><span className="text-xs font-mono text-zinc-500 block mb-1">number</span> The numeric monetary/balance value of the voucher.</div>
                                    </li>
                                    <li className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-left">
                                        <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400 min-w-24">currency<span className="text-red-500 ml-1">*</span></div>
                                        <div><span className="text-xs font-mono text-zinc-500 block mb-1">string</span> Currency code (e.g. "USD", "LYD", "EUR").</div>
                                    </li>
                                    <li className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-left">
                                        <div className="font-mono font-medium text-blue-600 dark:text-blue-400 min-w-24">campaignId</div>
                                        <div><span className="text-xs font-mono text-zinc-500 block mb-1">string (optional)</span> Map to an explicit tracking campaign.</div>
                                    </li>
                                </ul>

                                <h4 className="font-semibold mb-3 text-left">Expected Responses</h4>
                                <ul className="space-y-2 text-sm list-none p-0 text-left">
                                    <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> <strong>200 OK</strong> - Voucher generated successfully. Returns the exact secure code once.</li>
                                    <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> <strong>400 Bad Request</strong> - Missing/invalid amounts.</li>
                                </ul>
                            </div>
                            <div className="flex flex-col justify-start w-full text-left" style={{ direction: 'ltr' }}>
                                <Tabs dir="ltr" value={activeLanguage} onValueChange={setActiveLanguage} className="w-full text-left">
                                    <TabsList className="w-full justify-start rounded-b-none border-b border-zinc-900 bg-zinc-950 px-0 py-0 h-12 flex-nowrap overflow-x-auto gap-0">
                                        {LANGUAGES.map(lang => (
                                            <TabsTrigger key={lang.id} value={lang.id} className="data-[state=active]:!bg-zinc-900 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:!text-zinc-100 data-[state=active]:!shadow-none text-zinc-500 hover:text-zinc-300 transition-all font-mono text-xs uppercase tracking-wider whitespace-nowrap rounded-none h-full px-6 border-b-2 border-transparent">
                                                {lang.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {LANGUAGES.map(lang => (
                                        <TabsContent key={lang.id} value={lang.id} className="m-0">
                                            <CodeBlock
                                                code={generateCode('issue', lang.id)}
                                                language={lang.langInfo}
                                                id={`code-issue-${lang.id}`}
                                            />
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            </div>
                        </section>

                        {/* 2. Bulk Issue */}
                        <section id="bulk-issue" className="scroll-mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12 text-left" style={{ direction: 'ltr' }}>
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">POST</span>
                                    <h3 className="text-2xl font-bold">Bulk Issue Vouchers</h3>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-mono text-sm bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-left">
                                    {`/api/partner/v1/vouchers/bulk-issue`}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed text-left">
                                    Issues multiple vouchers in a single transaction payload. Max limit of 1,000 vouchers per batch request.
                                </p>
                                <h4 className="font-semibold mb-3 text-left">Body Parameters</h4>
                                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6 shadow-sm text-left">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5"><Package className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /></div>
                                        <div>
                                            <p className="text-sm text-indigo-900 dark:text-indigo-300 font-bold mb-1">Inherits Standard Issue Parameters</p>
                                            <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                                                In addition to <code className="font-mono font-bold">count</code>, this endpoint requires all the standard base parameters from the <a href="#issue-voucher" className="underline hover:text-indigo-900 dark:hover:text-indigo-200 font-semibold">Issue Voucher</a> method: <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono">amount</code>, <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono">currency</code>, and optionally <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono">campaignId</code>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <ul className="space-y-4 text-sm mb-6 list-none p-0 text-left">
                                    <li className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                        <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400 min-w-24">count<span className="text-red-500 ml-1">*</span></div>
                                        <div><span className="text-xs font-mono text-zinc-500 block mb-1">number</span> Number of vouchers to create (1-1000).</div>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex flex-col justify-start w-full text-left" style={{ direction: 'ltr' }}>
                                <Tabs dir="ltr" value={activeLanguage} onValueChange={setActiveLanguage} className="w-full text-left">
                                    <TabsList className="w-full justify-start rounded-b-none border-b border-zinc-900 bg-zinc-950 px-0 py-0 h-12 flex-nowrap overflow-x-auto gap-0">
                                        {LANGUAGES.map(lang => (
                                            <TabsTrigger key={lang.id} value={lang.id} className="data-[state=active]:!bg-zinc-900 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:!text-zinc-100 data-[state=active]:!shadow-none text-zinc-500 hover:text-zinc-300 transition-all font-mono text-xs uppercase tracking-wider whitespace-nowrap rounded-none h-full px-6 border-b-2 border-transparent">
                                                {lang.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {LANGUAGES.map(lang => (
                                        <TabsContent key={lang.id} value={lang.id} className="m-0">
                                            <CodeBlock
                                                code={generateCode('bulk-issue', lang.id)}
                                                language={lang.langInfo}
                                                id={`code-bulk-${lang.id}`}
                                            />
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            </div>
                        </section>

                        {/* 3. Void Voucher */}
                        <section id="void-voucher" className="scroll-mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12 text-left" style={{ direction: 'ltr' }}>
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">POST</span>
                                    <h3 className="text-2xl font-bold">Void a Voucher</h3>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-mono text-sm bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-left">
                                    {`/api/partner/v1/vouchers/void`}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed text-left">
                                    Forcibly invalidates an active voucher issued by your partner account. Once voided, a voucher can no longer be redeemed.
                                </p>
                                <h4 className="font-semibold mb-3 text-left">Body Parameters</h4>
                                <ul className="space-y-4 text-sm mb-6 list-none p-0 text-left">
                                    <li className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                        <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400 min-w-24">voucherId<span className="text-red-500 ml-1">*</span></div>
                                        <div><span className="text-xs font-mono text-zinc-500 block mb-1">string</span> The secure UUID ID received upon issuing the voucher.</div>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex flex-col justify-start w-full text-left" style={{ direction: 'ltr' }}>
                                <Tabs dir="ltr" value={activeLanguage} onValueChange={setActiveLanguage} className="w-full text-left">
                                    <TabsList className="w-full justify-start rounded-b-none border-b border-zinc-900 bg-zinc-950 px-0 py-0 h-12 flex-nowrap overflow-x-auto gap-0">
                                        {LANGUAGES.map(lang => (
                                            <TabsTrigger key={lang.id} value={lang.id} className="data-[state=active]:!bg-zinc-900 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:!text-zinc-100 data-[state=active]:!shadow-none text-zinc-500 hover:text-zinc-300 transition-all font-mono text-xs uppercase tracking-wider whitespace-nowrap rounded-none h-full px-6 border-b-2 border-transparent">
                                                {lang.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {LANGUAGES.map(lang => (
                                        <TabsContent key={lang.id} value={lang.id} className="m-0">
                                            <CodeBlock
                                                code={generateCode('void', lang.id)}
                                                language={lang.langInfo}
                                                id={`code-void-${lang.id}`}
                                            />
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            </div>
                        </section>

                        {/* 4. Check status */}
                        <section id="check-status" className="scroll-mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12 text-left" style={{ direction: 'ltr' }}>
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">GET</span>
                                    <h3 className="text-2xl font-bold">Check Status</h3>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 font-mono text-sm bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-left">
                                    {`/api/partner/v1/vouchers/{external_id}/status`}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed text-left">
                                    Fetch the real-time fulfillment status of an issued voucher id. Will return if it is active, redeemed, or void.
                                </p>
                            </div>
                            <div className="flex flex-col justify-start w-full text-left" style={{ direction: 'ltr' }}>
                                <Tabs dir="ltr" value={activeLanguage} onValueChange={setActiveLanguage} className="w-full text-left">
                                    <TabsList className="w-full justify-start rounded-b-none border-b border-zinc-900 bg-zinc-950 px-0 py-0 h-12 flex-nowrap overflow-x-auto gap-0">
                                        {LANGUAGES.map(lang => (
                                            <TabsTrigger key={lang.id} value={lang.id} className="data-[state=active]:!bg-zinc-900 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:!text-zinc-100 data-[state=active]:!shadow-none text-zinc-500 hover:text-zinc-300 transition-all font-mono text-xs uppercase tracking-wider whitespace-nowrap rounded-none h-full px-6 border-b-2 border-transparent">
                                                {lang.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {LANGUAGES.map(lang => (
                                        <TabsContent key={lang.id} value={lang.id} className="m-0">
                                            <CodeBlock
                                                code={generateCode('status', lang.id)}
                                                language={lang.langInfo}
                                                id={`code-status-${lang.id}`}
                                            />
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PartnerApiDocsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">Loading documentation...</div>}>
            <PartnerApiDocsContent />
        </Suspense>
    );
}
