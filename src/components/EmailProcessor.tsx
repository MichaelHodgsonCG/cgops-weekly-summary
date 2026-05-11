import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface RawEmail {
  id: string;
  subject: string;
  received_at: string;
  from_email: string;
  raw_json: {
    attachments?: Array<{
      file_name?: string;
      content?: string;
      content_type?: string;
    }>;
  };
}

export function EmailProcessor() {
  const [emails, setEmails] = useState<RawEmail[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    try {
      const { data, error } = await supabase
        .from('raw_emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setLoading(false);
    }
  }

  async function processEmail(email: RawEmail) {
    setProcessing(email.id);
    try {
      const attachments = email.raw_json.attachments || [];

      const slpAttachment = attachments.find(att => {
        const fileName = att.file_name?.toLowerCase() || '';
        const contentType = att.content_type?.toLowerCase() || '';
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
                       contentType.includes('spreadsheet') || contentType.includes('excel');
        const isCSV = fileName.endsWith('.csv') && contentType.includes('csv');
        const isNotImage = !contentType.includes('image') && !fileName.match(/\.(png|jpg|jpeg|gif|bmp)$/i);
        return (isExcel || isCSV) && isNotImage;
      });

      if (!slpAttachment || !slpAttachment.content) {
        setResults(prev => ({ ...prev, [email.id]: { success: false, message: 'No valid attachment found' } }));
        return;
      }

      const fileName = slpAttachment.file_name?.toLowerCase() || '';
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-slp-attachment`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent: slpAttachment.content,
          fileType: isExcel ? 'excel' : 'csv'
        })
      });

      const result = await response.json();

      if (result.success) {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: true,
            message: `Processed: ${result.stats?.totalLocations || 0} locations`
          }
        }));
        await loadEmails();
      } else {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: false,
            message: result.error || 'Processing failed'
          }
        }));
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [email.id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setProcessing(null);
    }
  }

  async function processLogbookEmail(email: RawEmail) {
    setProcessing(email.id);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-daily-logbook`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: email.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: true,
            message: 'Logbook processed successfully'
          }
        }));
      } else {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: false,
            message: result.error || 'Processing failed'
          }
        }));
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [email.id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setProcessing(null);
    }
  }

  async function processFeedbackEmail(email: RawEmail) {
    setProcessing(email.id);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-guest-feedback`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: email.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: true,
            message: `Processed ${result.count} review(s)`
          }
        }));
      } else {
        setResults(prev => ({
          ...prev,
          [email.id]: {
            success: false,
            message: result.error || 'Processing failed'
          }
        }));
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [email.id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Email Processor</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manually process SLP attachments and Daily Logbook emails
          </p>
        </div>
        <button
          onClick={loadEmails}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Received
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Attachments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {emails.map(email => {
              const attachments = email.raw_json.attachments || [];
              const hasAttachments = attachments.length > 0;
              const isLogbook = email.subject?.includes('Daily Logbook');
              const isRollUp = email.subject?.toLowerCase().includes('roll up');
              const isFeedback = email.subject?.includes('Daily review report');
              const result = results[email.id];

              return (
                <tr key={email.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{email.subject}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {email.from_email}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(email.received_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {hasAttachments ? (
                      <div className="space-y-1">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="text-xs text-slate-500">
                            {att.file_name || 'Unnamed'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {(hasAttachments || isRollUp) && (
                        <button
                          onClick={() => processEmail(email)}
                          disabled={processing === email.id}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {processing === email.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Process SLP'
                          )}
                        </button>
                      )}
                      {isLogbook && (
                        <button
                          onClick={() => processLogbookEmail(email)}
                          disabled={processing === email.id}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {processing === email.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Process Logbook'
                          )}
                        </button>
                      )}
                      {isFeedback && (
                        <button
                          onClick={() => processFeedbackEmail(email)}
                          disabled={processing === email.id}
                          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {processing === email.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Process Review'
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {result && (
                      <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        {result.success ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span>{result.message}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
