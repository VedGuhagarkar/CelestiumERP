import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { PageHeader } from '../design-system/navigation/PageHeader.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { StatusBadge } from '../design-system/feedback/StatusBadge.js';
import { env } from '../config/env.config.js';
import { getAuthHeaders } from '../utils/apiAuth.js';

interface Shift {
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  scheduledHeadcount: number;
  activeHeadcount: number;
  supervisorName: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedShift: string;
  status: 'ON_DUTY' | 'OFF_DUTY' | 'ON_LEAVE';
  certifications: string[];
}

const DEFAULT_SHIFTS: Shift[] = [
  { shiftCode: 'SHIFT-MORNING-A', name: 'Morning Thermal Processing Shift A', startTime: '06:00', endTime: '14:00', scheduledHeadcount: 6, activeHeadcount: 6, supervisorName: 'Bob Supervisor' },
  { shiftCode: 'SHIFT-AFTERNOON-B', name: 'Afternoon Heat Treat Shift B', startTime: '14:00', endTime: '22:00', scheduledHeadcount: 5, activeHeadcount: 5, supervisorName: 'David Shiftlead' },
  { shiftCode: 'SHIFT-NIGHT-C', name: 'Night Vacuum Cycle Shift C', startTime: '22:00', endTime: '06:00', scheduledHeadcount: 4, activeHeadcount: 4, supervisorName: 'Frank Nightlead' }
];

const DEFAULT_STAFF: StaffMember[] = [
  { id: 'usr_01', name: 'Alice Plant', email: 'manager@astralis.internal', role: 'Plant Manager', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['NADCAP Lead', 'AMS 2750G Auditor'] },
  { id: 'usr_02', name: 'Bob Supervisor', email: 'supervisor@astralis.internal', role: 'Production Supervisor', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['CQI-9 Heat Treat Lead', 'Furnace Level 3'] },
  { id: 'usr_03', name: 'Charlie Operator', email: 'operator@astralis.internal', role: 'Furnace Operator', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['Vacuum Furnace Operator', 'Quench Specialist'] },
  { id: 'usr_04', name: 'Diana Quality', email: 'qc@astralis.internal', role: 'Quality Manager', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['ASQ Quality Manager', 'NADCAP QA Signoff'] },
  { id: 'usr_05', name: 'Edward Lab', email: 'lab@astralis.internal', role: 'Metallurgical Lab Tech', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['Rockwell / Vickers Certified', 'Microstructure Level 2'] },
  { id: 'usr_06', name: 'Frank Maintenance', email: 'maintenance@astralis.internal', role: 'Maintenance Tech', assignedShift: 'SHIFT-MORNING-A', status: 'ON_DUTY', certifications: ['AMS 2750G TUS Surveyor', 'SAT Thermocouple Calibrator'] }
];

export const WorkforcePage: React.FC = () => {
  const [shifts] = useState<Shift[]>(DEFAULT_SHIFTS);
  const [staff, setStaff] = useState<StaffMember[]>(DEFAULT_STAFF);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkforceData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${env.API_BASE_URL}/attendance/status`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.presentStaff) setStaff(json.data.presentStaff);
      }
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkforceData();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Workforce & Shift Attendance"
        subtitle="Operator shift rosters, furnace certifications, pyrometry survey authorizations, and plant headcount"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AppButton variant="secondary" onClick={fetchWorkforceData} leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}>
              Refresh
            </AppButton>
            <AppButton variant="primary" leftIcon={<UserCheck size={14} />}>
              Clock In / Log Attendance
            </AppButton>
          </div>
        }
      />

      {/* Shifts Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {shifts.map((s) => (
          <AppCard key={s.shiftCode} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{s.shiftCode}</span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Hours: {s.startTime} - {s.endTime} | Supervisor: {s.supervisorName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>{s.activeHeadcount}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}> / {s.scheduledHeadcount}</span>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Present</div>
              </div>
            </div>
          </AppCard>
        ))}
      </div>

      {/* Staff Roster & Certifications Table */}
      <AppCard style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>STAFF MEMBER</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SYSTEM ROLE</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ASSIGNED SHIFT</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>PYROMETRY / NADCAP CERTS</th>
                <th style={{ padding: '14px 18px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>DUTY STATUS</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.email} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: '#ffffff' }}>{member.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{member.email}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--color-primary)', fontWeight: 600 }}>{member.role}</td>
                  <td style={{ padding: '14px 18px', color: '#e2e8f0' }}>{member.assignedShift}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {member.certifications.map((c) => (
                        <span key={c} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <StatusBadge status={member.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </PageContainer>
  );
};
