'use client';

import { useState, useEffect } from 'react';
import MemberForm from '@/components/MemberForm';
import Link from 'next/link';

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/members');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      // Include inactive members if showInactive is true
      const allMembersResponse = await fetch('/api/data/member?limit=1000');
      const allMembersData = await allMembersResponse.json();

      if (showInactive) {
        setMembers(allMembersData.data);
      } else {
        setMembers(data.members);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [showInactive]);

  const handleAddMember = () => {
    setEditingMember(null);
    setIsMemberFormOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setIsMemberFormOpen(true);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('このメンバーを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/members?id=${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete member');
      }

      fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleMemberFormClose = () => {
    setIsMemberFormOpen(false);
    setEditingMember(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-8">
          <p className="text-red-400 mb-4">エラー: {error}</p>
          <button
            onClick={fetchMembers}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">メンバー管理</h1>
            <p className="text-gray-400">チームメンバーの管理</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
            >
              タスク管理に戻る
            </Link>
            <button
              onClick={handleAddMember}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              + メンバーを追加
            </button>
          </div>
        </header>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">メンバー一覧 ({members.length}名)</h2>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mr-2"
              />
              無効なメンバーも表示
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                <tr>
                  <th className="px-4 py-3">名前</th>
                  <th className="px-4 py-3">メールアドレス</th>
                  <th className="px-4 py-3">役割</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">作成日</th>
                  <th className="px-4 py-3">アクション</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      メンバーがいません
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-gray-700 hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 font-semibold">{member.name}</td>
                      <td className="px-4 py-3">{member.email || '-'}</td>
                      <td className="px-4 py-3">{member.role || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            member.is_active
                              ? 'bg-green-600'
                              : 'bg-gray-600'
                          }`}
                        >
                          {member.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(member.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <MemberForm
          isOpen={isMemberFormOpen}
          onClose={handleMemberFormClose}
          onSave={fetchMembers}
          editData={editingMember}
        />
      </div>
    </div>
  );
}
