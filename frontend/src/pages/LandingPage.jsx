import { Link } from 'react-router-dom'
import { Factory, Shield, Calculator, BarChart3, Users, Cloud, ArrowRight, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  const features = [
    { icon: FileText, title: 'GST Invoices', desc: 'Auto GST calculation (CGST/SGST/IGST), HSN codes, print-ready A4 invoices' },
    { icon: Calculator, title: 'GST Reports', desc: 'GSTR-1, GSTR-2, GSTR-3B summaries with monthly breakdowns' },
    { icon: BarChart3, title: 'Dashboard & Analytics', desc: 'Revenue metrics, sales charts, ageing reports at a glance' },
    { icon: Users, title: 'Multi-User', desc: 'Role-based access: Admin, Accountant, Viewer. Same org, multiple users' },
    { icon: Cloud, title: 'Cloud-Based', desc: 'Access from any device. Auto backups. No desktop software needed' },
    { icon: Shield, title: 'Secure', desc: 'JWT auth, encrypted passwords, audit logs, rate limiting' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white">
            <Factory size={22} />
          </div>
          <span className="font-bold text-xl text-gray-900">Glob ERP</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-secondary">Login</Link>
          <Link to="/register" className="btn-primary">Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 py-20 md:py-32 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <CheckCircle size={16} /> Made for Indian Fabrication Businesses
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Your Complete <span className="text-primary-600">GST-Compliant</span> ERP
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Invoices, Quotations, Purchase Bills, GST Reports, and more — all in one place. 
          Built for fabrication & manufacturing businesses in India.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
            Get Started Free <ArrowRight size={20} />
          </Link>
          <Link to="/login" className="btn-secondary text-lg px-8 py-3">Sign In</Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card hover:shadow-md transition-shadow">
                <f.icon className="text-primary-600 mb-3" size={32} />
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Free Forever</h2>
          <p className="text-gray-500 mb-8">No hidden charges. No credit card required.</p>
          <div className="card text-left">
            <p className="text-4xl font-bold text-primary-600 mb-1">₹0<span className="text-lg text-gray-400">/month</span></p>
            <p className="text-gray-500 text-sm mb-4">For small fabrication businesses</p>
            <ul className="space-y-2 text-sm text-gray-600">
              {['Unlimited Invoices & Quotations', 'GST Reports (GSTR-1/2/3B)', 'Multi-user support', 'Excel Export', 'Cloud backup', 'Mobile responsive'].map(f => (
                <li key={f} className="flex items-center gap-2"><CheckCircle size={16} className="text-green-500" />{f}</li>
              ))}
            </ul>
            <Link to="/register" className="btn-primary w-full mt-6 block text-center">Start Now</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-900 text-gray-400 py-8 px-6 text-center text-sm">
        <p>© 2024 Glob Fabrication and Enterprises. All rights reserved.</p>
      </footer>
    </div>
  )
}

function FileText(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
}
