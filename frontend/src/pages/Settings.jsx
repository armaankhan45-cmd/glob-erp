import { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Save, Upload, Plus, Eye, EyeOff, Trash2, Mail, Send } from 'lucide-react'

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Verdana', 'Palatino', 'Garamond', 'Book Antiqua', 'Lucida Console']

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [org, setOrg] = useState({})
  const [settings, setSettings] = useState({})
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'viewer' })
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState({})
  const [deleting, setDeleting] = useState({})
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [showSmtpPass, setShowSmtpPass] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await api.get('/settings')
      setOrg(res.data.organization || {})
      setSettings(res.data.settings || {})
      const usersRes = await api.get('/auth/users')
      setUsers(usersRes.data.users || [])
    } catch (err) { console.error('Settings load error:', err) }
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      await api.post('/settings', {
        organization: {
          name: org.name, gstin: org.gstin, address: org.address, city: org.city, state: org.state,
          state_code: org.state_code, pincode: org.pincode, phone: org.phone, email: org.email,
          bank_name: org.bank_name, account_no: org.account_no, ifsc: org.ifsc, upi_id: org.upi_id,
          branch: org.branch, invoice_prefix: org.invoice_prefix, quotation_prefix: org.quotation_prefix,
          print_letterhead_mm: parseInt(org.print_letterhead_mm) || 65, print_footer_mm: parseInt(org.print_footer_mm) || 50,
          smtp_host: org.smtp_host || '', smtp_port: org.smtp_port || '587',
          smtp_user: org.smtp_user || '', smtp_pass: org.smtp_pass || ''
        },
        settings: {
          print_font_size: settings.print_font_size || '10',
          print_font_family: settings.print_font_family || 'Arial',
          invoice_item_bold: settings.invoice_item_bold || 'false',
          invoice_desc_size: settings.invoice_desc_size || '10',
          quotation_font_family: settings.quotation_font_family || 'Georgia',
          quotation_font_size: settings.quotation_font_size || '9',
          app_font_family: settings.app_font_family || 'Inter',
          default_gst_rate: settings.default_gst_rate || '18'
        }
      })
      await refreshUser()
      setMsg('✓ Settings saved successfully!')
    } catch (err) { setMsg('✗ Failed to save settings') }
    finally { setSaving(false) }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true); setEmailMsg('')
    const emailTo = prompt('Enter email to send test to:', org.smtp_user || org.email || '')
    if (!emailTo) { setTestingEmail(false); return }
    try {
      // First save the SMTP settings
      await api.post('/settings', {
        organization: {
          name: org.name, gstin: org.gstin, address: org.address, city: org.city, state: org.state,
          state_code: org.state_code, pincode: org.pincode, phone: org.phone, email: org.email,
          bank_name: org.bank_name, account_no: org.account_no, ifsc: org.ifsc, upi_id: org.upi_id,
          branch: org.branch, invoice_prefix: org.invoice_prefix, quotation_prefix: org.quotation_prefix,
          print_letterhead_mm: parseInt(org.print_letterhead_mm) || 65, print_footer_mm: parseInt(org.print_footer_mm) || 50,
          smtp_host: org.smtp_host || '', smtp_port: org.smtp_port || '587',
          smtp_user: org.smtp_user || '', smtp_pass: org.smtp_pass || ''
        },
        settings: { print_font_size: settings.print_font_size || '10', print_font_family: settings.print_font_family || 'Arial',
          invoice_item_bold: settings.invoice_item_bold || 'false', invoice_desc_size: settings.invoice_desc_size || '10',
          quotation_font_family: settings.quotation_font_family || 'Georgia', quotation_font_size: settings.quotation_font_size || '9',
          app_font_family: settings.app_font_family || 'Inter', default_gst_rate: settings.default_gst_rate || '18' }
      })
      // Then send test email
      const res = await api.post('/settings/test-email', { to: emailTo })
      if (res.data.success) setEmailMsg(`✓ Test email sent to ${emailTo}! Check your inbox.`)
      else setEmailMsg(`✗ ${res.data.msg}`)
    } catch (err) { setEmailMsg(`✗ Test failed: ${err.response?.data?.msg || err.message}`) }
    setTestingEmail(false)
  }

  const uploadImage = async (field, file) => {
    if (!file) return
    setUploading(prev => ({ ...prev, [field]: true }))
    const formData = new FormData()
    formData.append(field, file)
    try {
      const res = await api.post(`/settings/upload/${field}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOrg({ ...org, [`${field}_url`]: res.data[`${field}Url`] || res.data.logoUrl })
      setMsg(`✓ ${field.charAt(0).toUpperCase() + field.slice(1)} uploaded!`)
    } catch (err) { setMsg(`✗ ${field} upload failed`) }
    setUploading(prev => ({ ...prev, [field]: false }))
  }

  const deleteImage = async (field) => {
    if (!confirm(`Remove this ${field}? This cannot be undone.`)) return
    setDeleting(prev => ({ ...prev, [field]: true }))
    try {
      await api.delete(`/settings/upload/${field}`)
      setOrg({ ...org, [`${field}_url`]: null })
      setMsg(`✓ ${field.charAt(0).toUpperCase() + field.slice(1)} removed!`)
    } catch (err) { setMsg(`✗ Failed to remove ${field}`) }
    setDeleting(prev => ({ ...prev, [field]: false }))
  }

  const handleChangePassword = async () => {
    try {
      await api.post('/auth/change-password', passwordForm)
      setMsg('✓ Password changed!'); setPasswordForm({ currentPassword: '', newPassword: '' })
    } catch (err) { setMsg(err.response?.data?.msg || '✗ Failed') }
  }

  const handleAddUser = async () => {
    try {
      await api.post('/auth/users', newUser)
      setNewUser({ name: '', email: '', password: '', role: 'viewer' })
      loadData(); setMsg('✓ User added!')
    } catch (err) { setMsg(err.response?.data?.msg || '✗ Failed') }
  }

  const update = (key, val) => setOrg({ ...org, [key]: val })
  const updateSetting = (key, val) => setSettings({ ...settings, [key]: val })

  const UploadRow = ({ label, field, accept='.png,.jpg,.jpeg,.webp', previewUrl, circular }) => (
    <div className="flex items-center gap-4 flex-wrap">
      {previewUrl ? (
        <div className="flex items-center gap-3">
          <div style={{ width: '64px', height: circular ? '64px' : '48px', borderRadius: circular ? '50%' : '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
            <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <button
            onClick={() => deleteImage(field)}
            disabled={deleting[field]}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
          >
            <Trash2 size={12} /> {deleting[field] ? 'Removing...' : 'Remove'}
          </button>
        </div>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No image uploaded</span>
      )}
      <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
        style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--accent)' }}>
        <Upload size={12} /> {previewUrl ? 'Replace' : 'Upload'}
        <input type="file" accept={accept} onChange={e => uploadImage(field, e.target.files[0])} className="hidden" />
      </label>
      {uploading[field] && <span className="text-xs accent-text">Uploading...</span>}
      <span className="text-xs text-white/30">Max 2MB</span>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {msg && <div className={`p-3 rounded-lg text-sm font-medium ${msg.includes('✗') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{msg}</div>}

      {/* Company Details */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Company Details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Company Name</label><input value={org.name || ''} onChange={e => update('name', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">GSTIN</label><input value={org.gstin || ''} onChange={e => update('gstin', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Address</label><input value={org.address || ''} onChange={e => update('address', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-sm font-medium text-white/70 mb-1">City</label><input value={org.city || ''} onChange={e => update('city', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-white/70 mb-1">State</label><input value={org.state || ''} onChange={e => update('state', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-white/70 mb-1">Pincode</label><input value={org.pincode || ''} onChange={e => update('pincode', e.target.value)} className="input-field" /></div>
          </div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Phone</label><input value={org.phone || ''} onChange={e => update('phone', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Email</label><input value={org.email || ''} onChange={e => update('email', e.target.value)} className="input-field" /></div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Bank Details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Bank Name</label><input value={org.bank_name || ''} onChange={e => update('bank_name', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Account No</label><input value={org.account_no || ''} onChange={e => update('account_no', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">IFSC</label><input value={org.ifsc || ''} onChange={e => update('ifsc', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Branch</label><input value={org.branch || ''} onChange={e => update('branch', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">UPI ID</label><input value={org.upi_id || ''} onChange={e => update('upi_id', e.target.value)} className="input-field" /></div>
        </div>
      </div>

      {/* Logo + Stamp + Signature Upload */}
      <div className="card space-y-5">
        <h3 className="font-bold text-lg">Images & Signatures</h3>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Business Logo (shows on invoice & sidebar)</label>
          <UploadRow label="Logo" field="logo" previewUrl={org.logo_url} circular />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Company Stamp / Seal (auto-stamps on invoices & quotations)</label>
          <UploadRow label="Stamp" field="stamp" previewUrl={org.stamp_url} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Authorized Signature (auto-signs on invoices & quotations)</label>
          <UploadRow label="Signature" field="signature" previewUrl={org.signature_url} />
        </div>
      </div>

      {/* Invoice Font & Text Settings */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Invoice Text Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Invoice Font Family</label>
            <select value={settings.print_font_family || 'Arial'} onChange={e => updateSetting('print_font_family', e.target.value)} className="input-field">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Invoice Font Size: {settings.print_font_size || '10'}pt</label>
            <input type="range" min="8" max="14" step="0.5" value={settings.print_font_size || 10} onChange={e => updateSetting('print_font_size', e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Item Description Size: {settings.invoice_desc_size || '10'}pt</label>
            <input type="range" min="8" max="14" step="0.5" value={settings.invoice_desc_size || 10} onChange={e => updateSetting('invoice_desc_size', e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Item Text Style</label>
            <select value={settings.invoice_item_bold || 'false'} onChange={e => updateSetting('invoice_item_bold', e.target.value)} className="input-field">
              <option value="false">Normal</option>
              <option value="true">Bold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quotation Font Settings */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Quotation Font Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Quotation Font Family</label>
            <select value={settings.quotation_font_family || 'Georgia'} onChange={e => updateSetting('quotation_font_family', e.target.value)} className="input-field">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Quotation Font Size: {settings.quotation_font_size || '9'}pt</label>
            <input type="range" min="7" max="14" step="0.5" value={settings.quotation_font_size || 9} onChange={e => updateSetting('quotation_font_size', e.target.value)} className="w-full" />
          </div>
        </div>
        <div className="border rounded-lg p-4 print-preview" style={{ fontFamily: settings.quotation_font_family || 'Georgia', fontSize: `${settings.quotation_font_size || 9}pt`, background: '#fff' }}>
          <p style={{ lineHeight: 1.35 }}>DESIGN & FABRICATION OF SS304 TANK<br />• SHELL: 3.5 MM THICK<br />• DISH END: 3.5 MM THICK</p>
        </div>
      </div>

      {/* App Font Settings */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">App Font Settings</h3>
        <select value={settings.app_font_family || 'Inter'} onChange={e => updateSetting('app_font_family', e.target.value)} className="input-field">
          {['Inter', 'Arial', 'Roboto', 'Helvetica', 'Segoe UI', 'Verdana', 'Georgia', 'Times New Roman'].map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Document Numbering */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Document Numbering</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Invoice Prefix</label><input value={org.invoice_prefix || ''} onChange={e => update('invoice_prefix', e.target.value)} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Quotation Prefix</label><input value={org.quotation_prefix || ''} onChange={e => update('quotation_prefix', e.target.value)} className="input-field" /></div>
        </div>
      </div>

      {/* Print Layout */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Print Layout</h3>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Letterhead Top Space: {org.print_letterhead_mm || 59}mm</label>
          <input type="range" min="30" max="80" value={org.print_letterhead_mm || 59} onChange={e => update('print_letterhead_mm', e.target.value)} className="w-full" />
          <p className="text-xs text-white/30 mt-1">Blank space at top for printed letterhead</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Footer Bottom Space: {org.print_footer_mm || 30}mm</label>
          <input type="range" min="10" max="60" value={org.print_footer_mm || 30} onChange={e => update('print_footer_mm', e.target.value)} className="w-full" />
          <p className="text-xs text-white/30 mt-1">Blank space at bottom for sign/stamp</p>
        </div>
      </div>

      {/* ═══ Email Settings (Gmail SMTP) ═══ */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2"><Mail size={20} className="text-blue-400" /> Email Settings (Gmail SMTP)</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          Configure Gmail SMTP to send invoices & quotations directly via email from the app.
          <br />You need a <strong className="text-cyan-400">Google App Password</strong> (NOT your regular Gmail password).
          <br />Steps: ① Enable 2FA on your Google Account → ② Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-cyan-400 underline">myaccount.google.com/apppasswords</a> → ③ Generate a 16-char App Password → ④ Enter it below.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">SMTP Host</label>
            <input value={org.smtp_host || ''} onChange={e => update('smtp_host', e.target.value)} className="input-field" placeholder="smtp.gmail.com" />
            <p className="text-xs text-white/30 mt-1">Gmail: smtp.gmail.com</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">SMTP Port</label>
            <select value={org.smtp_port || '587'} onChange={e => update('smtp_port', e.target.value)} className="input-field">
              <option value="587">587 (TLS/STARTTLS)</option>
              <option value="465">465 (SSL)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">SMTP User (Your Gmail)</label>
            <input value={org.smtp_user || ''} onChange={e => update('smtp_user', e.target.value)} className="input-field" placeholder="admin@globfabrication.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">SMTP Password (App Password)</label>
            <div className="relative">
              <input type={showSmtpPass ? 'text' : 'password'} value={org.smtp_pass || ''} onChange={e => update('smtp_pass', e.target.value)} className="input-field pr-10" placeholder="xxxx xxxx xxxx xxxx" />
              <button onClick={() => setShowSmtpPass(!showSmtpPass)} className="absolute right-2 top-2 text-white/30 hover:text-white/60 transition-colors">
                {showSmtpPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-white/30 mt-1">16-character Google App Password</p>
          </div>
        </div>
        {emailMsg && <div className={`p-3 rounded-lg text-sm font-medium ${emailMsg.includes('✗') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{emailMsg}</div>}
        <div className="flex items-center gap-3">
          <button onClick={handleTestEmail} disabled={testingEmail} className="btn-secondary flex items-center gap-2">
            <Send size={16} /> {testingEmail ? 'Sending...' : 'Send Test Email'}
          </button>
          {!org.smtp_host && <span className="text-xs text-amber-400">⚠ Not configured — email sharing will use mailto: fallback</span>}
          {org.smtp_host && org.smtp_user && org.smtp_pass && <span className="text-xs text-emerald-400">✓ SMTP configured</span>}
        </div>
      </div>

      {/* Change Password */}
      <div className="card space-y-4">
        <h3 className="font-bold text-lg">Change Password</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Current Password</label>
            <div className="relative"><input type={showPassword ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="input-field pr-10" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-white/30">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">New Password</label><input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="input-field" /></div>
        </div>
        <button onClick={handleChangePassword} className="btn-primary text-sm">Change Password</button>
      </div>

      {/* User Management */}
      {user?.role === 'admin' && (
        <div className="card space-y-4">
          <h3 className="font-bold text-lg">User Management</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-white/40 text-left"><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th></tr></thead>
            <tbody>{users.map(u => (<tr key={u.id} className="border-b border-white/5"><td className="py-2">{u.name}</td><td className="py-2">{u.email}</td><td className="py-2"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5">{u.role}</span></td></tr>))}</tbody>
          </table>
          <div className="grid md:grid-cols-4 gap-3">
            <input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="input-field" placeholder="Name" />
            <input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="input-field" placeholder="Email" />
            <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="input-field" placeholder="Password" />
            <div className="flex gap-2">
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="input-field">
                <option value="admin">Admin</option><option value="accountant">Accountant</option><option value="viewer">Viewer</option>
              </select>
              <button onClick={handleAddUser} className="btn-primary text-sm whitespace-nowrap flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        <Save size={18} /> {saving ? 'Saving...' : 'Save All Settings'}
      </button>
    </div>
  )
}
