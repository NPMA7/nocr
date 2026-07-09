import React, { useEffect, useState } from "react";
import axios from "axios";
import { ShieldAlert, Activity, Info, ShieldCheck, RefreshCw, Power, Zap, Settings, X } from "lucide-react";
import { useToast } from "@/hooks/useToast";

export default function OntDetailView({ portId, ontId, canManageOlt = false, showStandaloneReboot = false, rebootTimestamp = 0, editTimestamp = 0, onRebootSuccess, onEditNameDesc }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRebooting, setIsRebooting] = useState(false);
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const fetchDetails = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const res = await axios.get(
        `/api/hsgq-olt/ont-detail?port_id=${portId}&ont_id=${ontId}`,
      );
      setData({
        base: res.data.base?.data || {},
        version: res.data.version?.data || {},
        capability: res.data.capability?.data || {},
        optical: res.data.optical?.data || {},
      });
    } catch (err) {
      console.error("Failed to fetch ONT details", err);
      if (!silent) {
        setError("Gagal memuat detail ONT. Pastikan perangkat terhubung.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleReboot = async () => {
    if (!canManageOlt) return;
    setShowRebootConfirm(true);
  };

  const confirmReboot = async () => {
    setShowRebootConfirm(false);
    if (!canManageOlt) return;

    setIsRebooting(true);
    try {
      const identifier = (Number(portId) << 8) | Number(ontId);
      const payload = {
        method: "set",
        param: {
          identifier: identifier,
          flags: 4,
          ont_name: "",
          ont_description: "",
        },
      };

      const response = await axios.post("/api/hsgq-olt?action=set_info", payload);
      if (response.data && response.data.code === 1) {
        // Instantly transition local state to offline/initial for real-time visualization
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            base: {
              ...prev.base,
              rstate: 0, // offline
              cstate: 0, // failed / initial
              mstate: 0, // initial
            }
          };
        });
        // Background re-fetch after 3 seconds so the OLT registers the actual status change
        setTimeout(() => {
          fetchDetails(true);
          if (onRebootSuccess) {
            onRebootSuccess();
          }
        }, 3000);
      } else {
        showToast("Gagal reboot ONT: " + (response.data?.message || "Error tidak diketahui"));
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal reboot ONT: " + (err.response?.data?.error || err.message));
    } finally {
      setIsRebooting(false);
    }
  };

  useEffect(() => {
    if (portId == null || ontId == null) return;
    fetchDetails(false);

    // Periodic lazy auto-refresh every 1 minute
    const interval = setInterval(() => {
      fetchDetails(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [portId, ontId, editTimestamp]);

  useEffect(() => {
    if (rebootTimestamp > 0) {
      // Instantly transition local state to offline/initial for real-time visualization
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          base: {
            ...prev.base,
            rstate: 0, // offline
            cstate: 0, // failed / initial
            mstate: 0, // initial
          }
        };
      });
      // Background re-fetch after 3 seconds so the OLT registers the actual status change
      const timer = setTimeout(() => {
        fetchDetails(true);
        if (onRebootSuccess) {
          onRebootSuccess();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [rebootTimestamp]);

  if (portId == null || ontId == null) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Pilih Port ID dan Name untuk melihat detail ONT.
      </div>
    );
  }

  const b = data?.base || {};
  const v = data?.version || {};
  const c = data?.capability || {};
  const o = data?.optical || {};

  // Helper for rows
  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors px-2 rounded-md">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-200 text-xs font-medium text-right break-all ml-4">
        {value !== "" && value !== undefined && value !== null ? value : "-"}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs animate-pulse">
          Mengambil data dari OLT...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-400">
        <ShieldAlert size={40} className="text-red-500/70" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-200">
      {ToastComponent}
      {canManageOlt && showStandaloneReboot && (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (onEditNameDesc) {
                onEditNameDesc(b.ont_name || "", b.ont_description || "");
              }
            }}
            className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-blue-950/20"
          >
            <Settings size={14} />
            Setting Description
          </button>
          <button
            onClick={handleReboot}
            disabled={isRebooting}
            className="cursor-pointer px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-red-950/20"
          >
            {isRebooting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Power size={14} />
            )}
            Reboot ONT
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Left Column: Basic Info */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={18} />
          ONT Basic Information
        </h3>
        <div className="space-y-0.5">
          <DetailRow label="Serial Number" value={b.ont_sn} />          
          <DetailRow label="Name" value={b.ont_name} />
          <DetailRow label="ONT description" value={b.ont_description} />
          <DetailRow
            label="State"
            value={b.state === 1 ? "Active" : "Inactive"}
          />
          <DetailRow
            label="Running state"
            value={b.rstate === 1 ? "online" : "offline"}
          />
          <DetailRow
            label="Config state"
            value={b.cstate === 1 ? "normal" : "failed"}
          />
          <DetailRow
            label="Match state"
            value={
              b.mstate === 0 ? "initial" : b.mstate === 1 ? "match" : "mismatch"
            }
          />
          <DetailRow label="Uptime" value={b.uptime} />
          <DetailRow label="Last down cause" value={b.last_d_cause} />
          <DetailRow label="Last down time" value={b.last_d_time} />
          <DetailRow label="Last up time" value={b.last_u_time} />
          <DetailRow label="Last dying timestamp" value={b.last_dg_time} />
          <DetailRow label="ONT Type" value={b.onu_type} />
          
          <DetailRow label="ONT Password" value={b.ont_passwd} />
          <DetailRow label="LOID" value={b.loid} />
          <DetailRow label="LOID Password" value={b.loid_password} />
          <DetailRow label="Us SD Ber" value={b.us_ber} />
          <DetailRow label="Ds SD Ber" value={b.ds_ber} />
          <DetailRow label="Distance(m)" value={b.distance} />
          <DetailRow
            label="Auth Mode"
            value={ 
              b.auth_mode === 0
                ? "SN AUTH"
                : b.auth_mode === 1
                  ? "LOID AUTH"
                  : "LOID+PASS"
            }
          />
          <DetailRow
            label="ONT Speed"
            value={b.onuspeed === 0 ? "1.25G/2.5G" : b.onuspeed}
          />
          <DetailRow label="LineProfile ID" value={b.lineprof_id} />
          <DetailRow label="LineProfile Name" value={b.lineprof_name} />
          <DetailRow label="SrvProfile ID" value={b.srvprof_id} />
          <DetailRow label="SrvProfile Name" value={b.srvprof_name} />
        </div>
      </div>

      {/* Right Column: Version & Capability & Optical */}
      <div className="space-y-6">
        {/* Optical Information Card */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            ONT Optical Information
          </h3>
          <div className="space-y-0.5">
            <DetailRow label="Work Temperature" value={o.work_temperature} />
            <DetailRow label="Work Voltage" value={o.work_voltage} />
            <DetailRow label="Transmit Bias" value={o.transmit_bias} />
            <DetailRow label="Transmit Power" value={o.transmit_power} />
            <DetailRow label="Receive Power" value={o.receive_power} />
            <DetailRow label="OLT Rx ONT Power" value={o.olt_rxpower} />
          </div>
        </div>

        {/* Version Information */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Info size={18} />
            Version Information
          </h3>
          <div className="space-y-0.5">
            <DetailRow label="Vendor ID" value={v.vendorid} />
            <DetailRow label="ONT Version" value={v.ont_version} />
            <DetailRow label="Equipment ID" value={v.equipmentid} />
            <DetailRow label="OMCC Version" value={v.omcc_version} />
            <DetailRow label="Product Code" value={v.product_code} />
            <DetailRow label="Main Software Version" value={v.mainversion} />
            <DetailRow label="Standby Software Version" value={v.stbversion} />
          </div>
        </div>

        {/* Capability Information */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <ShieldCheck size={18} />
            ONT Capability
          </h3>
          <div className="space-y-0.5">
            <DetailRow label="PON Ports" value={c.ani_num} />
            <DetailRow label="Ethernet Ports" value={c.eth_uni} />
            <DetailRow label="Pots Ports" value={c.pots_uni} />
            <DetailRow label="Total Gemports" value={c.gem_num} />
            <DetailRow label="Total T-CONTs" value={c.tcont_num} />
            <DetailRow
              label="IP Configuration"
              value={c.iphost_num > 0 ? "Support" : "Not Support"}
            />
            <DetailRow
              label="VeIP"
              value={c.veip_num > 0 ? "Support" : "Not Support"}
            />
            <DetailRow
              label="WAN Interface"
              value={c.wan === 1 ? "Support" : "Not Support"}
            />
            <DetailRow
              label="WLAN"
              value={c.wlan === 1 ? "Support" : "Not Support"}
            />
            <DetailRow
              label="WLAN 5G"
              value={c.wlan5g === 1 ? "Support" : "Not Support"}
            />
            <DetailRow label="WIFI Number" value={c.wifi_num} />
            <DetailRow
              label="CATV"
              value={c.catv_num > 0 ? "Support" : "Not Support"}
            />
          </div>
        </div>
      </div>
      </div>
    </div>

      {/* Reboot Confirmation Modal */}
      {showRebootConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Power size={16} className="text-red-400" />
                Konfirmasi Reboot ONT
              </h3>
              <button onClick={() => setShowRebootConfirm(false)} className="cursor-pointer text-slate-400 hover:text-slate-200 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin me-reboot ONT ini?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                ⚠️ ONT akan offline sementara selama proses reboot berlangsung.
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setShowRebootConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmReboot}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-xs text-white font-semibold transition cursor-pointer"
                >
                  <Power size={13} />
                  Ya, Reboot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
