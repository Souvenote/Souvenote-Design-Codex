"use client";

import * as React from "react";
import { BmcIcon } from "./BmcShared";

export type DeliveryMode = "single" | "multiple";
export type DeliveryWhen = "now" | "schedule";

export type DeliveryRecipient = {
  title: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type DeliveryErrors = Partial<Record<keyof DeliveryRecipient, string>>;

type DeliveryCountry = {
  code: string;
  name: string;
  region: string;
  postal: string;
  carrier: string;
};

type DlvAddressFieldsProps = {
  value: DeliveryRecipient;
  onChange: (next: DeliveryRecipient) => void;
  errors?: DeliveryErrors;
  compact?: boolean;
};

type DlvRecipientSectionProps = {
  mode: DeliveryMode;
  setMode: React.Dispatch<React.SetStateAction<DeliveryMode>>;
  recipients: DeliveryRecipient[];
  setRecipients: React.Dispatch<React.SetStateAction<DeliveryRecipient[]>>;
  draft: DeliveryRecipient;
  setDraft: React.Dispatch<React.SetStateAction<DeliveryRecipient>>;
  errors: DeliveryErrors;
  setErrors: React.Dispatch<React.SetStateAction<DeliveryErrors>>;
  editingIdx: number | null;
  setEditingIdx: React.Dispatch<React.SetStateAction<number | null>>;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
};

type DlvReturnSectionProps = {
  on: boolean;
  setOn: React.Dispatch<React.SetStateAction<boolean>>;
  sender: DeliveryRecipient;
  setSender: React.Dispatch<React.SetStateAction<DeliveryRecipient>>;
};

type DlvScheduleSectionProps = {
  when: DeliveryWhen;
  setWhen: React.Dispatch<React.SetStateAction<DeliveryWhen>>;
  date: string;
  setDate: React.Dispatch<React.SetStateAction<string>>;
};

type DlvShippingSectionProps = {
  shipping: string;
  setShipping: React.Dispatch<React.SetStateAction<string>>;
  country: string;
};

const DLV_TITLES = ["", "Mr", "Ms", "Mrs", "Mx", "Dr"];

const DLV_COUNTRIES: DeliveryCountry[] = [
  { code: "CA", name: "Canada", region: "Province", postal: "Postal code", carrier: "Canada Post" },
  { code: "US", name: "United States", region: "State", postal: "ZIP code", carrier: "USPS" },
];

function dlvCountry(code: string) {
  return DLV_COUNTRIES.find((country) => country.code === code) || DLV_COUNTRIES[0];
}

const DLV_EMPTY_RECIP: DeliveryRecipient = {
  title: "",
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  address3: "",
  city: "",
  state: "",
  postalCode: "",
  country: "CA",
};

const DLV_REQUIRED: (keyof DeliveryRecipient)[] = ["firstName", "lastName", "address1", "city", "state", "postalCode"];

function dlvValidate(recipient: DeliveryRecipient): DeliveryErrors {
  const errs: DeliveryErrors = {};
  DLV_REQUIRED.forEach((key) => {
    if (!String(recipient[key] || "").trim()) errs[key] = "Required";
  });

  const pc = String(recipient.postalCode || "").trim();
  if (pc && !errs.postalCode) {
    const ok = recipient.country === "US"
      ? /^\d{5}(-\d{4})?$/.test(pc)
      : /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(pc);
    if (!ok) errs.postalCode = recipient.country === "US" ? "Enter a valid ZIP code" : "Enter a valid postal code";
  }

  return errs;
}

function dlvSummaryLine(recipient: DeliveryRecipient) {
  const line1 = [recipient.address1, recipient.address2].filter(Boolean).join(", ");
  const line2 = [recipient.city, recipient.state, recipient.postalCode].filter(Boolean).join(" \u00b7 ");
  return [line1, line2, dlvCountry(recipient.country).name].filter(Boolean).join("  \u2014  ");
}

function DlvAddressFields({ value, onChange, errors = {}, compact = false }: DlvAddressFieldsProps) {
  const c = dlvCountry(value.country);
  const set = (key: keyof DeliveryRecipient) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...value, [key]: event.target.value });
  };
  const err = (key: keyof DeliveryRecipient) => errors[key] ? "is-error" : "";

  return (
    <div className="dlv-fgrid" style={{ gap: 16 }}>
      <div className="dlv-fgrid title-name">
        <div className="dlv-field">
          <label className="bmc-label">Title</label>
          <select className="dlv-select" value={value.title} onChange={set("title")}>
            {DLV_TITLES.map((title) => <option key={title} value={title}>{title || "\u2014"}</option>)}
          </select>
        </div>
        <div className="dlv-field">
          <label className="bmc-label">First name<span className="dlv-req">*</span></label>
          <input className={`dlv-input ${err("firstName")}`} value={value.firstName} onChange={set("firstName")} placeholder="Jane" />
          {errors.firstName && <span className="dlv-err-msg">{errors.firstName}</span>}
        </div>
        <div className="dlv-field">
          <label className="bmc-label">Last name<span className="dlv-req">*</span></label>
          <input className={`dlv-input ${err("lastName")}`} value={value.lastName} onChange={set("lastName")} placeholder="Wilson" />
          {errors.lastName && <span className="dlv-err-msg">{errors.lastName}</span>}
        </div>
      </div>

      <div className="dlv-field">
        <label className="bmc-label">Company <span className="bmc-opt">(optional)</span></label>
        <input className="dlv-input" value={value.company} onChange={set("company")} placeholder="Add a company or 'c/o' line" />
      </div>

      <div className="dlv-field">
        <label className="bmc-label">Address line 1<span className="dlv-req">*</span></label>
        <input className={`dlv-input ${err("address1")}`} value={value.address1} onChange={set("address1")} placeholder="123 Maple Street" />
        {errors.address1 && <span className="dlv-err-msg">{errors.address1}</span>}
      </div>

      {!compact && (
        <div className="dlv-fgrid cols-2">
          <div className="dlv-field">
            <label className="bmc-label">Address line 2 <span className="bmc-opt">(optional)</span></label>
            <input className="dlv-input" value={value.address2} onChange={set("address2")} placeholder="Apt, suite, unit" />
          </div>
          <div className="dlv-field">
            <label className="bmc-label">Address line 3 <span className="bmc-opt">(optional)</span></label>
            <input className="dlv-input" value={value.address3} onChange={set("address3")} placeholder="Building, floor" />
          </div>
        </div>
      )}

      <div className="dlv-fgrid cols-3">
        <div className="dlv-field">
          <label className="bmc-label">City<span className="dlv-req">*</span></label>
          <input className={`dlv-input ${err("city")}`} value={value.city} onChange={set("city")} placeholder="Vancouver" />
          {errors.city && <span className="dlv-err-msg">{errors.city}</span>}
        </div>
        <div className="dlv-field">
          <label className="bmc-label">{c.region}<span className="dlv-req">*</span></label>
          <input className={`dlv-input ${err("state")}`} value={value.state} onChange={set("state")} placeholder={c.region} />
          {errors.state && <span className="dlv-err-msg">{errors.state}</span>}
        </div>
        <div className="dlv-field">
          <label className="bmc-label">{c.postal}<span className="dlv-req">*</span></label>
          <input className={`dlv-input ${err("postalCode")}`} value={value.postalCode} onChange={set("postalCode")} placeholder={c.postal} />
          {errors.postalCode && <span className="dlv-err-msg">{errors.postalCode}</span>}
        </div>
      </div>

      <div className="dlv-field">
        <label className="bmc-label">Country<span className="dlv-req">*</span></label>
        <select className="dlv-select" value={value.country} onChange={set("country")}>
          {DLV_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function DlvRecipientSection({
  mode,
  setMode,
  recipients,
  setRecipients,
  draft,
  setDraft,
  errors,
  setErrors,
  editingIdx,
  setEditingIdx,
  quantity,
  setQuantity,
}: DlvRecipientSectionProps) {
  function commitDraft() {
    const nextErrors = dlvValidate(draft);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    if (editingIdx === null) setRecipients([...recipients, draft]);
    else setRecipients(recipients.map((recipient, index) => index === editingIdx ? draft : recipient));
    setDraft({ ...DLV_EMPTY_RECIP, country: draft.country });
    setEditingIdx(null);
    setErrors({});
  }

  function editRecip(index: number) {
    setDraft(recipients[index]);
    setEditingIdx(index);
    setErrors({});
  }

  function removeRecip(index: number) {
    setRecipients(recipients.filter((_, recipientIndex) => recipientIndex !== index));
    if (editingIdx === index) {
      setDraft({ ...DLV_EMPTY_RECIP });
      setEditingIdx(null);
    }
  }

  return (
    <div className="bmc-card dlv-section">
      <div className="dlv-section-head">
        <div className="dlv-section-title">
          <span className="dlv-section-num">1</span> Who&apos;s it going to?
        </div>
        <div className="bmc-chip-row">
          <button type="button" className={`bmc-chip ${mode === "single" ? "is-active" : ""}`} onClick={() => setMode("single")}>One recipient</button>
          <button type="button" className={`bmc-chip ${mode === "multiple" ? "is-active" : ""}`} onClick={() => setMode("multiple")}>Multiple</button>
        </div>
      </div>

      {mode === "multiple" && recipients.length > 0 && (
        <div className="dlv-recip-list" style={{ marginBottom: 18 }}>
          {recipients.map((recipient, index) => (
            <div key={index} className={`dlv-recip-item ${editingIdx === index ? "is-editing" : ""}`}>
              <span className="dlv-recip-badge">{index + 1}</span>
              <div>
                <div className="dlv-recip-name">{[recipient.title, recipient.firstName, recipient.lastName].filter(Boolean).join(" ")}</div>
                <div className="dlv-recip-addr">{dlvSummaryLine(recipient)}</div>
              </div>
              <div className="dlv-recip-acts">
                <button type="button" className="dlv-icon-btn" onClick={() => editRecip(index)} aria-label="Edit"><BmcIcon name="edit" w={15} /></button>
                <button type="button" className="dlv-icon-btn" onClick={() => removeRecip(index)} aria-label="Remove"><BmcIcon name="close" w={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "multiple" && (
        <div className="bmc-label" style={{ marginBottom: 14, color: "var(--rose-gold)" }}>
          {editingIdx === null ? `Add recipient ${recipients.length + 1}` : `Editing recipient ${editingIdx + 1}`}
        </div>
      )}

      <DlvAddressFields value={draft} onChange={setDraft} errors={errors} />

      {mode === "single" ? (
        <div className="dlv-qty">
          <div className="dlv-qty-copy">
            <div className="dlv-qty-title">How many cards to this address?</div>
            <div className="dlv-qty-sub">Send more than one copy of this card to the same recipient.</div>
          </div>
          <div className="dlv-qty-input-wrap">
            <input
              type="number"
              min="1"
              max="99"
              className="dlv-input dlv-qty-input"
              aria-label="Number of cards"
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
            />
            <span className="dlv-qty-unit">{quantity === 1 ? "card" : "cards"}</span>
          </div>
        </div>
      ) : (
        <button type="button" className="dlv-add-recip" style={{ marginTop: 18 }} onClick={commitDraft}>
          <BmcIcon name={editingIdx === null ? "plus" : "check"} w={15} />
          {editingIdx === null ? "Add this address" : "Save changes"}
        </button>
      )}
    </div>
  );
}

function DlvReturnSection({ on, setOn, sender, setSender }: DlvReturnSectionProps) {
  return (
    <div className="bmc-card dlv-section">
      <button type="button" className="dlv-collapse-toggle" onClick={() => setOn(!on)}>
        <div className="dlv-section-title">
          <span className="dlv-section-num">2</span> Return address
        </div>
        <span className={`dlv-switch ${on ? "is-on" : ""}`} />
      </button>
      {on ? (
        <div style={{ marginTop: 20 }}>
          <p className="bmc-help" style={{ margin: "0 0 16px" }}>
            Printed on the envelope flap so it can come home if it can&apos;t be delivered.
          </p>
          <DlvAddressFields value={sender} onChange={setSender} compact />
        </div>
      ) : (
        <p className="bmc-help" style={{ margin: "12px 0 0" }}>
          {"No return address \u2014 the envelope ships clean. Toggle on to add yours."}
        </p>
      )}
    </div>
  );
}

function DlvScheduleSection({ when, setWhen, date, setDate }: DlvScheduleSectionProps) {
  return (
    <div className="bmc-card dlv-section">
      <div className="dlv-section-head">
        <div className="dlv-section-title">
          <span className="dlv-section-num">3</span> When should it mail?
        </div>
        <div className="bmc-chip-row">
          <button type="button" className={`bmc-chip ${when === "now" ? "is-active" : ""}`} onClick={() => setWhen("now")}>Send now</button>
          <button type="button" className={`bmc-chip ${when === "schedule" ? "is-active" : ""}`} onClick={() => setWhen("schedule")}>Schedule</button>
        </div>
      </div>
      {when === "schedule" ? (
        <div className="dlv-schedule-date">
          <label className="bmc-label">Mail-out date</label>
          <input type="date" className="dlv-input" value={date} onChange={(event) => setDate(event.target.value)} style={{ maxWidth: 260 }} />
          <div className="dlv-eta-note">
            <BmcIcon name="message" w={16} />
            <span>We hand-write and post your card on this date, timed to land right on the occasion, not before.</span>
          </div>
        </div>
      ) : (
        <div className="dlv-eta-note">
          <BmcIcon name="sparkle" w={16} />
          <span>{"Into production within one business day. Most cards are written, posted, and on their way within 1\u20132 business days."}</span>
        </div>
      )}
    </div>
  );
}

function DlvShippingSection({ shipping, setShipping, country }: DlvShippingSectionProps) {
  const carrier = dlvCountry(country).carrier;
  const opts = [
    { id: "standard", name: "Standard", sub: `${carrier} \u00b7 5\u20137 business days`, price: "Included", free: true },
  ];

  return (
    <div className="bmc-card dlv-section">
      <div className="dlv-section-head">
        <div className="dlv-section-title">
          <span className="dlv-section-num">4</span> Shipping speed
        </div>
      </div>
      <div className="dlv-ship-opts">
        {opts.map((option) => (
          <label key={option.id} className={`dlv-ship-opt ${shipping === option.id ? "is-active" : ""}`}>
            <span className="dlv-radio" />
            <input type="radio" name="dlv-ship" checked={shipping === option.id} onChange={() => setShipping(option.id)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            <div>
              <div className="dlv-ship-name">{option.name}</div>
              <div className="dlv-ship-sub">{option.sub}</div>
            </div>
            <span className={`dlv-ship-price ${option.free ? "is-free" : ""}`}>{option.price}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export {
  DLV_TITLES,
  DLV_COUNTRIES,
  DLV_EMPTY_RECIP,
  DLV_REQUIRED,
  dlvCountry,
  dlvValidate,
  dlvSummaryLine,
  DlvAddressFields,
  DlvRecipientSection,
  DlvReturnSection,
  DlvScheduleSection,
  DlvShippingSection,
};
