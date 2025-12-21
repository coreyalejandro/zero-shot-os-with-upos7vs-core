import React from 'react';

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            UPOS7VS Enterprise
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Governance, compliance, and team management for AI development
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Why Enterprise?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-xl mb-3">🏢 Team Management</h3>
              <p className="text-gray-600">
                Role-based access, usage quotas, and centralized billing across your organization.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-xl mb-3">📋 Compliance</h3>
              <p className="text-gray-600">
                SOC2, GDPR, HIPAA dashboards. Audit logs and data retention policies built-in.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-xl mb-3">🔒 Security</h3>
              <p className="text-gray-600">
                SSO/SAML, API key rotation, secrets vault, and advanced PII scrubbing.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Pricing</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow border-2 border-transparent">
              <h3 className="font-bold text-xl mb-3">Starter</h3>
              <p className="text-4xl font-bold mb-4">$299<span className="text-lg text-gray-600">/mo</span></p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 10 users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Basic compliance dashboards</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Email support</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Usage analytics</span>
                </li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
                Start Trial
              </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2 border-blue-500">
              <div className="bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded-full inline-block mb-2">
                MOST POPULAR
              </div>
              <h3 className="font-bold text-xl mb-3">Growth</h3>
              <p className="text-4xl font-bold mb-4">$999<span className="text-lg text-gray-600">/mo</span></p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Up to 50 users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Advanced compliance (SOC2, GDPR)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Priority support (4-hour SLA)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>SSO/SAML integration</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Custom model fine-tuning</span>
                </li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
                Start Trial
              </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-2 border-transparent">
              <h3 className="font-bold text-xl mb-3">Enterprise</h3>
              <p className="text-4xl font-bold mb-4">Custom</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>White-label options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Dedicated support team</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>On-premise deployment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Custom SLA</span>
                </li>
              </ul>
              <button className="w-full bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900">
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        <section className="mb-16 bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6">Request Enterprise Trial</h2>
          <form className="max-w-2xl">
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="company">
                Company Name
              </label>
              <input
                type="text"
                id="company"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="email">
                Work Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@company.com"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="teamsize">
                Team Size
              </label>
              <select
                id="teamsize"
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>201-1000</option>
                <option>1000+</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="message">
                Message (Optional)
              </label>
              <textarea
                id="message"
                rows={4}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about your use case..."
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white py-3 px-8 rounded hover:bg-blue-700 font-semibold"
            >
              Request Trial Access
            </button>
          </form>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Trust & Security</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">SOC2 Type II Ready</h3>
              <p className="text-gray-600">
                We follow industry-standard security practices and are ready for SOC2 Type II certification.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">GDPR Compliant</h3>
              <p className="text-gray-600">
                Full GDPR compliance with data residency options and right-to-deletion support.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">HIPAA Available</h3>
              <p className="text-gray-600">
                Healthcare organizations can request HIPAA-compliant deployments with BAA.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">99.9% Uptime SLA</h3>
              <p className="text-gray-600">
                Enterprise plans include guaranteed uptime with credits for any downtime.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-blue-50 p-8 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-lg text-gray-700 mb-6">
            Join teams using UPOS7VS to build better AI products faster.
          </p>
          <div className="space-x-4">
            <button className="bg-blue-600 text-white py-3 px-8 rounded hover:bg-blue-700 font-semibold">
              Start Free Trial
            </button>
            <button className="bg-white text-blue-600 border-2 border-blue-600 py-3 px-8 rounded hover:bg-blue-50 font-semibold">
              Schedule Demo
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>Questions? Email us at <a href="mailto:enterprise@upos7vs.com" className="text-blue-400 hover:underline">enterprise@upos7vs.com</a></p>
          <p className="mt-2 text-gray-400">© 2025 UPOS7VS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
