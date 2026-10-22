import { useContext, useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { defaultSettings, SettingsContext } from '../context/SettingsContext.jsx';
import { listUsers, promoteUser, saveCompanySettings, saveNotificationPreferences, saveMessageTemplates, updateMyProfile } from '../services/userService.js';

const TABS = ['profile', 'team', 'notifications', 'company', 'messages'];
const tabLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Página de configurações da aplicação.
 * Agrupa perfis, equipe, notificações, empresa e modelos de mensagens.
 *
 * @returns {JSX.Element} Interface de configurações.
 */
export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useContext(AuthContext);
  const { settings, updateSettings, resetSettings } = useContext(SettingsContext);
  const [tab, setTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('');
  const [profileName, setProfileName] = useState('');
  const autoPersistedRef = useRef(false);
  const [companyForm, setCompanyForm] = useState({ companyName: '', companyAddress: '', companyEmail: '', companyPhone:'', company_vat: '', currency: 'EUR', timezone: 'Europe/Lisbon', dateFormat: 'dd/MM/yyyy' });
  const [notifications, setNotifications] = useState(settings.notifications);
  const [messages, setMessages] = useState(settings.messages);
  const [previewKey, setPreviewKey] = useState(null);

  const timeZoneOptions = useMemo(() => {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      return [...Intl.supportedValuesOf('timeZone')].sort();
    }

    return [
      'UTC',
      'Europe/Lisbon', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
      'Europe/Zurich', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
      'Europe/Dublin', 'Africa/Casablanca', 'Africa/Lagos', 'Africa/Johannesburg',
      'Asia/Dubai', 'Asia/Qatar', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Dhaka',
      'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
      'Asia/Singapore', 'Asia/Hong_Kong', 'Australia/Sydney', 'Australia/Perth',
      'Australia/Adelaide', 'Pacific/Auckland', 'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
      'America/Phoenix', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo',
      'America/Mexico_City', 'America/El_Salvador', 'America/Anchorage',
      'Pacific/Honolulu', 'Etc/GMT', 'Etc/UTC',
    ];
  }, []);

  const previewDate = new Date().toISOString().slice(2, 10).replace(/-/g, '');

  const sampleData = {
    supplier: {
      supplier_name: 'ACME Supplies',
      company_name: settings.companyName || 'SmartStock',
      company_address: 'Rua Principal, 123',
      contact_email: settings.companyEmail || 'contato@smartstock.com',
      contact_phone: settings.companyPhone || '+351 912 000 000',
      company_vat: 'PT123456789',
      date: new Date().toLocaleDateString(),
      po_number: `PO-${previewDate}`,
      items: [
        { name: 'Esquadro escolar 45°', ref: 'ESQ-45', quantity: 10, unit_price: '1.50', subtotal: '15.00' },
        { name: 'Marcador Stabilo', ref: 'MS-01', quantity: 5, unit_price: '0.80', subtotal: '4.00' },
      ],
      subtotal_total: '19.00',
      vat_rate: 23,
      vat_amount: '4.37',
      total_amount: '23.37',
      delivery_date: '2026-07-01',
      payment_terms: '30 days',
      partial_delivery: 'Allowed',
      acc_name: 'Accounts Team',
    },
    OrderConfirmation: {
      customer_name: 'João Silva',
      company_name: settings.companyName || 'SmartStock',
      reservation_code: `R-${previewDate}`,
      items: [{ name: 'Matemática A 10.º ano', quantity: 1 }],
      available_date: '2026-06-25',
      expiry_date: '2026-07-01',
    },
    ReservationReady: {
      customer_name: 'Maria Santos',
      company_name: settings.companyName || 'SmartStock',
      reservation_code: `R-${previewDate}`,
      items: [{ name: 'Física e Química A 10.º ano' }],
      store_name: 'Loja Central',
      store_address: 'Rua Central, 10',
      opening_hours: '9:00-19:00',
      pickup_deadline: '2026-07-07',
      total_amount: '26.90',
    },
  };

  const renderTemplate = (template, data = {}) => {
    if (!template) return '';
    // handle {{#each items}}...{{/each}}
    let out = template.replace(/{{#each\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/each}}/g, (_, arrName, inner) => {
      const arr = (data && data[arrName]) || [];
      return arr.map((item) => {
        return inner.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (m, key) => {
          return (item[key] !== undefined ? item[key] : (data && data[key]) || '');
        });
      }).join('');
    });
    // simple replacements
    out = out.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (m, key) => {
      return (data && data[key] !== undefined) ? data[key] : '';
    });
    return out;
  };

  const adjustTemplateTextareaHeight = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    const nextCompanyForm = {
      companyName: settings.companyName || '',
      companyAddress: settings.companyAddress || '',
      companyEmail: settings.companyEmail || '',
      companyPhone: settings.companyPhone || '',
      company_vat: settings.company_vat || '',
      currency: settings.currency || 'EUR',
      timezone: settings.timezone || 'Europe/Lisbon',
      dateFormat: settings.dateFormat || 'dd/MM/yyyy',
    };

    setCompanyForm(nextCompanyForm);
    setProfileName(settings.displayName || user?.name || '');
    setNotifications(settings.notifications);
    setMessages(settings.messages);
  }, [settings, user]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEditCompanySettings = isAdmin;
  const canEditTemplates = isAdmin;
  const canEditNotifications = isAdmin || isManager;
  const visibleTabs = TABS.filter((t) => {
    if (t === 'messages') return isAdmin || isManager; // employees cannot access messages
    if (t === 'company') return isAdmin || isManager; // only admin/manager can view company settings
    if (t === 'team') return isAdmin || isManager; // managers should also see the team list
    return true;
  });

  const persistSettingsSnapshot = async (sourceSettings = settings) => {
    const companyPayload = {
      company_name: sourceSettings.companyName || 'SmartStock',
      company_address: sourceSettings.companyAddress || 'Rua da Conveniência I',
      company_email: sourceSettings.companyEmail || 'albertooh2589@gmail.com',
      company_phone: sourceSettings.companyPhone || '911576629',
      company_vat: sourceSettings.company_vat || '',
      currency: sourceSettings.currency || 'EUR',
      timezone: sourceSettings.timezone || 'Europe/Lisbon',
      date_format: sourceSettings.dateFormat || 'dd/MM/yyyy',
      reservation_enabled: true,
      theme: sourceSettings.theme || 'light',
    };

    const messagesPayload = Object.fromEntries(
      Object.entries(sourceSettings.messages || {}).map(([key, template]) => [key, {
        subject: template?.subject || '',
        body: template?.body || '',
      }])
    );

    await saveCompanySettings(companyPayload);
    await saveMessageTemplates(messagesPayload);
  };

  useEffect(() => {
    const templateTextareas = document.querySelectorAll('.template-textarea');
    templateTextareas.forEach((element) => adjustTemplateTextareaHeight(element));
  }, [messages, tab]);

  useEffect(() => {
    if (autoPersistedRef.current) return;

    const persistInitialSettings = async () => {
      try {
        await persistSettingsSnapshot(settings);
        autoPersistedRef.current = true;
      } catch (err) {
        console.warn('Unable to auto-persist initial settings.', err);
      }
    };

    if (settings && user) {
      persistInitialSettings();
    }
  }, [settings, user]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      listUsers().then((res) => setUsers(res.data || [])).catch(() => setUsers([]));
    }
  }, [user?.role]);

  const saveCompany = async (e) => {
    e.preventDefault();
    if (!canEditCompanySettings) {
      setStatus('Managers can view company settings but cannot change them.');
      return;
    }
    try {
      await saveCompanySettings(companyForm);
      updateSettings(companyForm);
      setStatus('Company settings saved.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to save company settings.');
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateMyProfile({ name: profileName });
      setUser((current) => (current ? { ...current, name: profileName } : current));
      updateSettings({ displayName: profileName });
      setStatus('Profile updated successfully.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to update profile.');
    }
  };

  const saveLocale = (e) => {
    e.preventDefault();
    updateSettings(companyForm);
    setStatus('Regional settings saved.');
  };

  const saveNotifications = async (e) => {
    e.preventDefault();
    if (!canEditNotifications) {
      setStatus('Employees can view notification settings but cannot change them.');
      return;
    }
    updateSettings({ notifications });
    try {
      await saveNotificationPreferences({ notification_preferences: notifications });
      setStatus('Notification settings saved.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Saved locally, but failed to sync notification settings with the server.');
    }
  };

  const saveMessages = async (e) => {
    e.preventDefault();
    try {
      await saveMessageTemplates(messages);
      updateSettings({ messages });
      setStatus('Message templates saved.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to save message templates.');
    }
  };

  const handleResetSettings = async () => {
    const restoredSettings = {
      ...defaultSettings,
      notifications: {
        alerts: { ...defaultSettings.notifications.alerts },
        reports: { ...defaultSettings.notifications.reports },
      },
      messages: {
        ReservationReady: { ...defaultSettings.messages.ReservationReady },
        OrderConfirmation: { ...defaultSettings.messages.OrderConfirmation },
        supplier: { ...defaultSettings.messages.supplier },
      },
    };

    resetSettings();
    setCompanyForm({
      companyName: restoredSettings.companyName || '',
      companyAddress: restoredSettings.companyAddress || '',
      companyEmail: restoredSettings.companyEmail || '',
      companyPhone: restoredSettings.companyPhone || '',
      company_vat: restoredSettings.company_vat || '',
      currency: restoredSettings.currency || 'EUR',
      timezone: restoredSettings.timezone || 'Europe/Lisbon',
      dateFormat: restoredSettings.dateFormat || 'dd/MM/yyyy',
    });
    setProfileName(restoredSettings.displayName || user?.name || '');
    setNotifications(restoredSettings.notifications);
    setMessages(restoredSettings.messages);
    setPreviewKey(null);

    try {
      await persistSettingsSnapshot(restoredSettings);
      setStatus('Preferences reset to defaults and saved.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Preferences reset locally, but saving failed.');
    }
  };

  const handlePromote = async (id) => {
    try {
      await promoteUser(id, 'manager');
      setUsers((current) => current.map((item) => item.id === id ? { ...item, role: 'manager' } : item));
      setStatus('User promoted to manager.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to promote user.');
    }
  };
  const handleDemote = async (id) => {
    try {
      await promoteUser(id, 'employee');
      setUsers((current) => current.map((item) => item.id === id ? { ...item, role: 'employee' } : item));
      setStatus('User demoted to employee.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to demote user.');
    }
  };
  const activeUsers = useMemo(() => {
    return users
      .filter((item) => item.is_active !== false)
      .slice()
      .sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return aTime - bTime;
      });
  }, [users]);
const toggleDarkMode = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const nextTheme = isDark ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
};

  const templateDefinitions = [
    { key: 'OrderConfirmation', label: 'Reservation Confirmation' },
    { key: 'ReservationReady', label: 'Reservation Ready' },
    { key: 'supplier', label: 'Supplier - Purchase Order' },
  ];

  return (
   <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 , fontSize: '2rem' }}>Settings</h1>

      </div>
      
      <div className="settings-tabs">
        {visibleTabs.map((item) => (
          <button key={item} type="button" className={`settings-tab ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
            {tabLabel(item)}
          </button>
        ))}
      </div>

      {status ? <div className="card" style={{ padding: '.9rem 1rem' }}>{status}</div> : null}

{tab === 'profile' ? (
        <form className="card settings-card" onSubmit={saveProfile}>
          <h3 className="chart-title">Profile</h3>
               <div className="card settings-card">
          <p className="muted">
            Signed in as {user?.name} ({"role: "+user?.role})
          </p>
        </div>
          <div className="form-columns-2">
            <div>
              <label className="field-label">Display name</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input value={user?.email || ''} disabled />
            </div>
          </div>
                    <button type="button" className="btn-darkmode"onClick={toggleDarkMode}>Change Theme</button>
          <button type="submit">Save profile</button>

  
        </form>
      ) : null}

{tab === 'company' ? (
  <form className="card settings-card" onSubmit={saveCompany}>

    <h3 className="chart-title">Company Settings</h3>


    <div className="form-columns-2">

      <div>
        <label className="field-label">Company Name</label>
        <input
          value={companyForm.companyName || ''}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              companyName: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        />
      </div>


      <div>
        <label className="field-label">Company Address</label>
        <input
          value={companyForm.companyAddress || ''}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              companyAddress: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        />
      </div>

    </div>



    <div className="form-columns-2">

      <div>
        <label className="field-label">Company Phone</label>
        <input
          value={companyForm.companyPhone || ''}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              companyPhone: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        />
      </div>


      <div>
        <label className="field-label">Company Email</label>
        <input
          type="email"
          value={companyForm.companyEmail || ''}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              companyEmail: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        />
      </div>

    </div>




    <div className="form-columns-2">

      <div>
        <label className="field-label">Company VAT Number</label>
        <input
          type="text"
          value={companyForm.company_vat || ''}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              company_vat: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        />
      </div>


      <div>
        <label className="field-label">Currency</label>
        <select
          value={companyForm.currency || 'EUR'}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              currency: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
      </div>

    </div>




    <div className="form-columns-2">

      <div>
        <label className="field-label">Timezone</label>
        <select
          value={companyForm.timezone || 'Europe/Lisbon'}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              timezone: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        >
          {timeZoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label className="field-label">Date Format</label>
        <select
          value={companyForm.dateFormat || 'dd/MM/yyyy'}
          onChange={(e) =>
            setCompanyForm((p) => ({
              ...p,
              dateFormat: e.target.value,
            }))
          }
          disabled={!canEditCompanySettings}
        >
          <option value="dd/MM/yyyy">dd/MM/yyyy</option>
          <option value="MM/dd/yyyy">MM/dd/yyyy</option>
          <option value="yyyy-MM-dd">yyyy-MM-dd</option>
        </select>
      </div>

    </div>



    {!canEditCompanySettings ? (
      <div className="muted" style={{ marginTop: '.5rem' }}>Managers can view company settings but cannot change them.</div>
    ) : null}
    <button type="submit" disabled={!canEditCompanySettings}>
      Save settings
    </button>


  </form>
) : null}

      {tab === 'team' ? (
        <div className="card settings-card">
          <h3 className="chart-title">Team accounts</h3>
          <p className="muted">All new accounts start as employee. Admins can manage roles; managers can view the team list.</p>
          {!isAdmin && !isManager ? (
            <div className="empty-state" style={{ marginTop: '1rem' }}>Only admins and managers can view team accounts.</div>
          ) : (
            <div className="table-card" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.length === 0 ? (
                    <tr><td colSpan="5"><div className="empty-state" style={{ margin: '1rem 0' }}>No team members found.</div></td></tr>
                  ) : activeUsers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      <td><span className="chip chip-neutral">{member.role}</span></td>
                      <td>{member.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        {isAdmin ? (
                          member.role === 'employee' ? (
                            <button type="button" className="btn btn-success" onClick={() => handlePromote(member.id)}>Promote to manager</button>
                          ) : member.role === 'manager' ? (
                            <button type="button" className="btn btn-danger" onClick={() => handleDemote(member.id)}>Demote to employee</button>
                          ) : null
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <form className="card settings-card" onSubmit={saveNotifications}>
          <h3 className="chart-title">Notifications</h3>
          {!canEditNotifications ? (
            <p className="muted" style={{ marginTop: '-0.5rem' }}>
              You can view the notification settings, but only admins and managers can change them.
            </p>
          ) : null}
          <div className="grid-2" style={{ gap: '2rem' }}>
            {['alerts', 'reports'].map((group) => (
              <div key={group} className="product-tile">
                <strong style={{ textTransform: 'capitalize' }}>{group}</strong>
                {['email', 'sms'].map((channel) => (
                  <label key={channel} className="toggle-row">
                    <span>{channel.toUpperCase()}</span>
                    <input
                      type="checkbox"
                      disabled={!canEditNotifications}
                      checked={Boolean(notifications?.[group]?.[channel])}
                      onChange={(e) => setNotifications((current) => ({
                        ...current,
                        [group]: { ...(current?.[group] || {}), [channel]: e.target.checked },
                      }))}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
          {canEditNotifications ? (
            <button type="submit">Save notification settings</button>
          ) : null}
        </form>
      ) : null}

      {tab === 'messages' ? (
        <form className="card settings-card" onSubmit={saveMessages}>
          <h3 className="chart-title">Message templates</h3>
          {!canEditTemplates ? (
            <div className="empty-state" style={{ marginBottom: '1rem' }}>Managers can view the message previews below, but cannot edit the templates.</div>
          ) : null}
          <div className="grid-1">
            {templateDefinitions.map(({ key, label }) => (
              <div key={key} className="template-block" style={{ marginBottom: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <h4 style={{ margin: '.25rem 0 .75rem' }}>{label}</h4>
                {canEditTemplates ? (
                  <>
                    <label className="field-label">Subject</label>
                    <input
                      value={messages?.[key]?.subject || ''}
                      onChange={(e) => setMessages((p) => ({ ...p, [key]: { ...(p?.[key] || {}), subject: e.target.value } }))}
                      disabled={!canEditTemplates}
                    />
                    <label className="field-label">Body</label>
                    <textarea
                      className="template-textarea"
                      rows={1}
                      value={messages?.[key]?.body || ''}
                      style={{ minHeight: '8rem', overflow: 'hidden', resize: 'none', lineHeight: 1.5 }}
                      onInput={(e) => adjustTemplateTextareaHeight(e.target)}
                      onChange={(e) => setMessages((p) => ({ ...p, [key]: { ...(p?.[key] || {}), body: e.target.value } }))}
                      disabled={!canEditTemplates}
                    />
                    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', alignItems: 'center' }}>
                      <button type="button" className="btn-secondary" onClick={() => setPreviewKey(previewKey === key ? null : key)}>
                        {previewKey === key ? 'Hide Preview' : 'Preview'}
                      </button>
                      <div style={{ color: '#777', fontSize: '.9rem' }}>Placeholders: <span style={{ fontFamily: 'monospace' }}>{'{{company_name}}, {{customer_name}}, {{items}}, {{po_number}}, {{quantity}},{{name}},{{#each items}} {{/each}}, {{company_name}} '}</span></div>
                    </div>
                  </>
                ) : null}
                {(!canEditTemplates || previewKey === key) ? (
                  <div className="card" style={{ marginTop: '.5rem', whiteSpace: 'pre-wrap' }}>
                    <strong>Preview</strong>
                    <div style={{ marginTop: '.35rem' }}>
                      <strong>Subject:</strong> {renderTemplate(messages?.[key]?.subject || '', sampleData[key])}
                    </div>
                    <hr />
                    <div>{renderTemplate(messages?.[key]?.body || '', sampleData[key])}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {canEditTemplates ? <button type="submit">Save templates</button> : null}
        </form>
      ) : null}

      <div className="page-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to Overview</button>
        <button type="button" onClick={handleResetSettings}>Reset preferences</button>
      </div>
    </div>
  );
}
