import React, { useEffect, useState } from "react";
import axios from "axios";
import { ShieldAlert, Activity, Info, ShieldCheck } from "lucide-react";

export default function OntDetailView({ portId, ontId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (portId == null || ontId == null) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(
          `/api/hsgq-olt/ont-detail?port_id=${portId}&ont_id=${ontId}`,
        );
        setData({
          base: res.data.base?.data || {},
          version: res.data.version?.data || {},
          capability: res.data.capability?.data || {},
        });
      } catch (err) {
        console.error("Failed to fetch ONT details", err);
        setError("Gagal memuat detail ONT. Pastikan perangkat terhubung.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [portId, ontId]);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Left Column: Basic Info */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={18} />
          ONT Basic Information
        </h3>
        <div className="space-y-0.5">
          <DetailRow
            label="ONT Speed"
            value={b.onuspeed === 0 ? "1.25G/2.5G" : b.onuspeed}
          />
          <DetailRow label="Name" value={b.ont_name} />
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
          <DetailRow label="Serial Number" value={b.ont_sn} />
          <DetailRow label="ONT Password" value={b.ont_passwd} />
          <DetailRow label="LOID" value={b.loid} />
          <DetailRow label="LOID Password" value={b.loid_password} />
          <DetailRow label="Us SD Ber" value={b.us_ber} />
          <DetailRow label="Ds SD Ber" value={b.ds_ber} />
          <DetailRow label="Distance(m)" value={b.distance} />
          <DetailRow label="ONT Type" value={b.onu_type} />
          <DetailRow label="ONT description" value={b.ont_description} />
          <DetailRow label="Last down cause" value={b.last_d_cause} />
          <DetailRow label="Last down time" value={b.last_d_time} />
          <DetailRow label="Last up time" value={b.last_u_time} />
          <DetailRow label="Last dying timestamp" value={b.last_dg_time} />
          <DetailRow label="Uptime" value={b.uptime} />
          <DetailRow label="LineProfile ID" value={b.lineprof_id} />
          <DetailRow label="LineProfile Name" value={b.lineprof_name} />
          <DetailRow label="SrvProfile ID" value={b.srvprof_id} />
          <DetailRow label="SrvProfile Name" value={b.srvprof_name} />
        </div>
      </div>

      {/* Right Column: Version & Capability */}
      <div className="space-y-6">
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
  );
}
