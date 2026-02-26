"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  CONTACT_METHOD_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  MEMBER_STATUS_OPTIONS,
  MemberPayload,
  MemberProfile,
  toDateInputValue,
} from "@/lib/members";

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1200;

function fileSizeLabel(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected file."));
    reader.readAsDataURL(file);
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to process image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function createImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = source;
  });
}

async function cropAndCompressAvatar(source: string, crop: Area, maxBytes: number) {
  const image = await createImage(source);
  const sourceWidth = Math.max(1, Math.floor(crop.width));
  const sourceHeight = Math.max(1, Math.floor(crop.height));

  const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.floor(sourceWidth * scale));
  let height = Math.max(1, Math.floor(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to process image.");

  const draw = (targetWidth: number, targetHeight: number) => {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      targetWidth,
      targetHeight,
    );
  };

  draw(width, height);

  let quality = 0.92;
  let blob = await toBlob(canvas, quality);

  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await toBlob(canvas, quality);
  }

  while (blob.size > maxBytes && width > 240 && height > 240) {
    width = Math.max(240, Math.floor(width * 0.85));
    height = Math.max(240, Math.floor(height * 0.85));
    draw(width, height);
    quality = 0.86;
    blob = await toBlob(canvas, quality);

    while (blob.size > maxBytes && quality > 0.45) {
      quality -= 0.08;
      blob = await toBlob(canvas, quality);
    }
  }

  return blob;
}

type MemberProfileFormProps = {
  mode: "create" | "edit";
  initialValue?: MemberProfile | null;
  submitting?: boolean;
  onSubmit: (payload: MemberPayload) => Promise<void> | void;
  onCancel?: () => void;
};

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  occupation: string;
  avatarUrl: string;
  preferredContactMethod: string;
  membershipDate: string;
  baptismDate: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  status: string;
  tagsText: string;
};

function emptyState(): FormState {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    maritalStatus: "",
    occupation: "",
    avatarUrl: "",
    preferredContactMethod: "",
    membershipDate: "",
    baptismDate: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
    status: "Active",
    tagsText: "",
  };
}

function fromMember(member?: MemberProfile | null): FormState {
  if (!member) return emptyState();
  return {
    firstName: member.firstName ?? "",
    middleName: member.middleName ?? "",
    lastName: member.lastName ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    gender: member.gender ?? "",
    dateOfBirth: toDateInputValue(member.dateOfBirth),
    maritalStatus: member.maritalStatus ?? "",
    occupation: member.occupation ?? "",
    avatarUrl: member.avatarUrl ?? "",
    preferredContactMethod: member.preferredContactMethod ?? "",
    membershipDate: toDateInputValue(member.membershipDate),
    baptismDate: toDateInputValue(member.baptismDate),
    addressLine1: member.addressLine1 ?? "",
    addressLine2: member.addressLine2 ?? "",
    city: member.city ?? "",
    state: member.state ?? "",
    postalCode: member.postalCode ?? "",
    country: member.country ?? "",
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhone: member.emergencyContactPhone ?? "",
    notes: member.notes ?? "",
    status: member.status ?? "Active",
    tagsText: (member.tags ?? []).join(", "),
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function getInitials(firstName: string, lastName: string) {
  const left = firstName.trim().charAt(0);
  const right = lastName.trim().charAt(0);
  return `${left}${right}`.toUpperCase() || "MB";
}

export function MemberProfileForm({ mode, initialValue, submitting = false, onSubmit, onCancel }: MemberProfileFormProps) {
  const [form, setForm] = useState<FormState>(() => fromMember(initialValue));
  const [validationError, setValidationError] = useState("");
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState("");
  const [avatarUploadNotice, setAvatarUploadNotice] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [cropSourceName, setCropSourceName] = useState("");
  const [cropSourceBytes, setCropSourceBytes] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);

  const title = mode === "create" ? "Register Member" : "Edit Member";
  const description =
    mode === "create"
      ? "Capture the member's core profile now and extend over time."
      : "Update member profile details and keep records current.";

  useEffect(() => {
    setForm(fromMember(initialValue));
  }, [initialValue]);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const avatarSource = useMemo(() => {
    const trimmed = form.avatarUrl.trim();
    return trimmed || "";
  }, [form.avatarUrl]);

  const avatarInitials = useMemo(() => getInitials(form.firstName, form.lastName), [form.firstName, form.lastName]);
  const avatarBusy = avatarProcessing || uploadProgress !== null;

  const closeCropper = (force = false) => {
    if (avatarBusy && !force) return;
    setCropSource("");
    setCropSourceName("");
    setCropSourceBytes(0);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropAreaPixels(null);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Please select an image file.");
      setAvatarUploadNotice("");
      return;
    }

    if (file.size > MAX_SOURCE_BYTES) {
      setAvatarUploadError(`Image is too large (${fileSizeLabel(file.size)}). Please select an image under 15MB.`);
      setAvatarUploadNotice("");
      return;
    }

    setAvatarUploadError("");
    setAvatarUploadNotice("");
    setUploadProgress(null);

    try {
      const source = await readAsDataUrl(file);
      setCropSource(source);
      setCropSourceName(file.name);
      setCropSourceBytes(file.size);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropAreaPixels(null);
    } catch {
      setAvatarUploadError("Unable to read this image. Try another file.");
    }
  };

  const confirmCropUpload = async () => {
    if (!cropSource || !cropAreaPixels) {
      setAvatarUploadError("Select an image area before uploading.");
      return;
    }

    if (!storage) {
      setAvatarUploadError("Image upload is unavailable. Firebase Storage is not configured.");
      return;
    }

    setAvatarUploadError("");
    setAvatarUploadNotice("");
    setAvatarProcessing(true);

    try {
      const croppedBlob = await cropAndCompressAvatar(cropSource, cropAreaPixels, MAX_AVATAR_BYTES);
      setUploadProgress(0);

      const safeName = cropSourceName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[a-zA-Z0-9]+$/, "");
      const path = `member-avatars/${Date.now()}-${safeName || "member-avatar"}.jpg`;
      const fileRef = ref(storage, path);
      const task = uploadBytesResumable(fileRef, croppedBlob, { contentType: "image/jpeg" });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(progress);
          },
          (error) => reject(error),
          () => resolve(),
        );
      });

      const downloadUrl = await getDownloadURL(task.snapshot.ref);
      update("avatarUrl", downloadUrl);
      setAvatarUploadNotice(
        `Photo uploaded (${fileSizeLabel(cropSourceBytes)} → ${fileSizeLabel(croppedBlob.size)}).`,
      );
      closeCropper(true);
    } catch {
      setAvatarUploadError("Unable to crop/upload image right now. You can still paste an image URL manually.");
    } finally {
      setAvatarProcessing(false);
      setUploadProgress(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setValidationError("First name and last name are required.");
      return;
    }

    const payload: MemberPayload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      gender: form.gender || undefined,
      dateOfBirth: normalizeDate(form.dateOfBirth),
      maritalStatus: form.maritalStatus || undefined,
      occupation: form.occupation.trim() || undefined,
      avatarUrl: form.avatarUrl.trim() || undefined,
      preferredContactMethod: form.preferredContactMethod || undefined,
      membershipDate: normalizeDate(form.membershipDate),
      baptismDate: normalizeDate(form.baptismDate),
      addressLine1: form.addressLine1.trim() || undefined,
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      country: form.country.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status || undefined,
      tags: parseTags(form.tagsText),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
        {validationError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{validationError}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Profile Image</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarSource ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSource} alt="Member avatar preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-black text-slate-500">{avatarInitials}</span>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500">
                {avatarBusy ? "Uploading..." : "Upload Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarBusy || submitting} />
              </label>
              {form.avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    update("avatarUrl", "");
                    setAvatarUploadNotice("");
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={avatarBusy || submitting}
                >
                  Remove Photo
                </button>
              )}
            </div>
            <Input
              label="Profile image URL (optional override)"
              value={form.avatarUrl}
              onChange={(value) => update("avatarUrl", value)}
              placeholder="https://..."
            />
            <p className="text-xs text-slate-500">PNG/JPG/WebP supported. Crop + compression are automatic (target up to 1MB).</p>
          </div>
        </div>
        {uploadProgress !== null && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Uploading image...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        {avatarUploadError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{avatarUploadError}</p>
        )}
        {avatarUploadNotice && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{avatarUploadNotice}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Core Identity</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input label="First name *" value={form.firstName} onChange={(value) => update("firstName", value)} placeholder="First name" />
          <Input label="Middle name" value={form.middleName} onChange={(value) => update("middleName", value)} placeholder="Middle name" />
          <Input label="Last name *" value={form.lastName} onChange={(value) => update("lastName", value)} placeholder="Last name" />
          <Input label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} placeholder="name@church.com" />
          <Input label="Phone" value={form.phone} onChange={(value) => update("phone", value)} placeholder="+1 555 123 4567" />
          <Select
            label="Status"
            value={form.status}
            onChange={(value) => update("status", value)}
            options={MEMBER_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Personal Profile</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Select
            label="Gender"
            value={form.gender}
            onChange={(value) => update("gender", value)}
            options={GENDER_OPTIONS.map((gender) => ({ value: gender, label: gender }))}
          />
          <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => update("dateOfBirth", value)} />
          <Select
            label="Marital status"
            value={form.maritalStatus}
            onChange={(value) => update("maritalStatus", value)}
            options={MARITAL_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
          />
          <Input label="Occupation" value={form.occupation} onChange={(value) => update("occupation", value)} placeholder="Occupation" />
          <Select
            label="Preferred contact method"
            value={form.preferredContactMethod}
            onChange={(value) => update("preferredContactMethod", value)}
            options={CONTACT_METHOD_OPTIONS.map((method) => ({ value: method, label: method }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Church Records</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input label="Membership date" type="date" value={form.membershipDate} onChange={(value) => update("membershipDate", value)} />
          <Input label="Baptism date" type="date" value={form.baptismDate} onChange={(value) => update("baptismDate", value)} />
          <Input label="Tags (comma-separated)" value={form.tagsText} onChange={(value) => update("tagsText", value)} placeholder="Choir, Volunteer, Youth" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Address & Emergency</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input label="Address line 1" value={form.addressLine1} onChange={(value) => update("addressLine1", value)} />
          <Input label="Address line 2" value={form.addressLine2} onChange={(value) => update("addressLine2", value)} />
          <Input label="City" value={form.city} onChange={(value) => update("city", value)} />
          <Input label="State / Region" value={form.state} onChange={(value) => update("state", value)} />
          <Input label="Postal code" value={form.postalCode} onChange={(value) => update("postalCode", value)} />
          <Input label="Country" value={form.country} onChange={(value) => update("country", value)} />
          <Input label="Emergency contact name" value={form.emergencyContactName} onChange={(value) => update("emergencyContactName", value)} />
          <Input label="Emergency contact phone" value={form.emergencyContactPhone} onChange={(value) => update("emergencyContactPhone", value)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Pastoral Notes</h3>
        <textarea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={5}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Optional notes for care and follow-up context."
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || avatarBusy}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : mode === "create" ? "Create Member" : "Save Changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
      </div>

      {cropSource && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Crop Profile Image</p>
              <h4 className="mt-1 text-lg font-black text-slate-900">Adjust framing before upload</h4>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Source: {cropSourceName || "Selected image"} ({fileSizeLabel(cropSourceBytes)}) · output will be compressed to 1MB max.
              </p>
            </div>

            <div className="relative h-72 overflow-hidden rounded-xl bg-slate-900 sm:h-96">
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCropAreaPixels(pixels)}
              />
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeCropper()}
                disabled={avatarBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCropUpload()}
                disabled={avatarBusy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {avatarBusy ? "Processing..." : "Crop & Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

function Input({ label, value, onChange, placeholder, type = "text" }: InputProps) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
};

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
