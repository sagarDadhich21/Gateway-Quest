import { FormEvent, useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { AdminUserRow, adminUsers } from "../../mockData/admin";

const ROLES = ["Super Admin", "Admin", "Hotel Admin", "Support User"] as const;

function AddUserForm({ onSave }: { onSave: (user: { name: string; email: string; role: string }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLES[0]);
  const [nameErr, setNameErr] = useState("");
  const [emailErr, setEmailErr] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNameErr("");
    setEmailErr("");
    let hasError = false;
    if (!name.trim()) { setNameErr("Full name is required."); hasError = true; }
    if (!email.trim() || !email.includes("@")) { setEmailErr("A valid email is required."); hasError = true; }
    if (hasError) return;
    onSave({ name: name.trim(), email: email.trim(), role });
  }

  return (
    <form id="add-user-form" onSubmit={handleSubmit}>
      <label>Full name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      {nameErr && <div className="form-error" style={{ marginBottom: 0 }}>{nameErr}</div>}
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      {emailErr && <div className="form-error" style={{ marginBottom: 0 }}>{emailErr}</div>}
      <label>Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r}>{r}</option>)}
      </select>
    </form>
  );
}

export function AdminUsers() {
  const [rows, setRows] = useState<AdminUserRow[]>(adminUsers);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function toggleActive(u: AdminUserRow) {
    setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, active: !r.active } : r)));
    toast(u.active ? `${u.name} deactivated` : `${u.name} activated`, u.active ? "warn" : "ok");
  }

  function openAddUser() {
    showModal({
      title: "Add user",
      body: (
        <AddUserForm
          onSave={(user) => {
            setRows((prev) => [
              ...prev,
              { id: `U-${prev.length + 1}`, name: user.name, email: user.email, role: user.role as AdminUserRow["role"], active: true },
            ]);
            closeModal();
            toast(`${user.name} added`);
          }}
        />
      ),
      foot: (
        <>
          <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
          <button type="submit" form="add-user-form" className="button button--primary">Add user</button>
        </>
      ),
    });
  }

  const columns: DataTableColumn<AdminUserRow>[] = [
    { key: "name", label: "Name", render: (r) => <strong>{r.name}</strong> },
    { key: "email", label: "Email", render: (r) => r.email },
    { key: "role", label: "Role", render: (r) => r.role },
    { key: "active", label: "Status", render: (r) => (r.active ? <Pill label="Active" tone="success" /> : <Pill label="Disabled" tone="neutral" />) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => <button type="button" className="button button--ghost" onClick={() => toggleActive(r)}>{r.active ? "Deactivate" : "Activate"}</button>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Platform access"
        actions={<button type="button" className="button button--primary" onClick={openAddUser}>Add user</button>}
      />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
