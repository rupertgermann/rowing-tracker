"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Trash2, Key, UserCog, Mail, Calendar } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    rowingSessions: number;
    trainingPlans: number;
    earnedAwards: number;
  };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({ type: 'error', text: "Failed to load users" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This will delete ALL their data permanently.")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }

      setMessage({ type: 'success', text: "User deleted successfully" });
      fetchUsers();
      setSelectedUser(null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 8) {
      setMessage({ type: 'error', text: "Password must be at least 8 characters" });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }

      setMessage({ type: 'success', text: "Password reset successfully" });
      setShowResetPassword(false);
      setNewPassword("");
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    
    if (!confirm(`Change user role to ${newRole}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      setMessage({ type: 'success', text: `User role changed to ${newRole}` });
      fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/50 text-green-400' 
            : 'bg-red-500/10 border border-red-500/50 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Verified</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Sessions</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name || "No name"}</div>
                    <div className="text-xs text-muted-foreground">{user.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {user.role === 'admin' && <Shield className="w-3 h-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.emailVerified ? (
                      <span className="text-green-400 text-sm">✓ Verified</span>
                    ) : (
                      <span className="text-yellow-400 text-sm">⚠ Unverified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div>{user._count.rowingSessions} sessions</div>
                      <div className="text-xs text-muted-foreground">
                        {user._count.trainingPlans} plans, {user._count.earnedAwards} awards
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetPassword(true);
                        }}
                        disabled={actionLoading}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleRole(user.id, user.role)}
                        disabled={actionLoading || user.id === session?.user?.id}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={actionLoading || user.role === 'admin' || user.id === session?.user?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showResetPassword && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Reset Password</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Reset password for <strong>{selectedUser.email}</strong>
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full px-4 py-2 bg-background border rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleResetPassword(selectedUser.id)}
                disabled={actionLoading}
                className="flex-1"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetPassword(false);
                  setSelectedUser(null);
                  setNewPassword("");
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
