"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { X, Check, ShoppingCart, Heart, Loader2 } from "lucide-react";
import { SkillCard, type SkillCardData } from "@/components/SkillCard";

interface SkillWithOwnership extends SkillCardData {
  owned: boolean;
}

interface CopyBuildModalProps {
  agentName: string;
  skills: SkillCardData[];
  onClose: () => void;
}

export default function CopyBuildModal({
  agentName,
  skills,
  onClose,
}: CopyBuildModalProps) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [ownedSkillIds, setOwnedSkillIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's owned skills
  useEffect(() => {
    async function fetchOwnedSkills() {
      if (!ready || !authenticated) {
        setLoading(false);
        return;
      }

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/user/purchases", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch purchases");
        }

        const data = await res.json();
        const owned = new Set<string>(data.skills.map((s: { id: string }) => s.id));
        setOwnedSkillIds(owned);
      } catch (err) {
        console.error("Failed to fetch owned skills:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOwnedSkills();
  }, [ready, authenticated, getAccessToken]);

  // Categorize skills
  const skillsWithOwnership: SkillWithOwnership[] = skills.map((skill) => ({
    ...skill,
    owned: ownedSkillIds.has(skill.id),
  }));

  const ownedSkills = skillsWithOwnership.filter((s) => s.owned);
  const missingSkills = skillsWithOwnership.filter((s) => !s.owned);

  // Calculate total cost for missing skills
  const totalCost = missingSkills.reduce((sum, s) => sum + s.price, 0);

  // Handle Buy All Missing
  const handleBuyAll = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setBuying(true);
    setError(null);

    try {
      const token = await getAccessToken();

      // Buy each missing skill sequentially
      for (const skill of missingSkills) {
        const res = await fetch("/api/skills/buy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            skillId: skill.id,
            paymentMethod: skill.price === 0 ? "free" : "crypto",
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to buy ${skill.name}`);
        }
      }

      // Refresh owned skills
      const purchasesRes = await fetch("/api/user/purchases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (purchasesRes.ok) {
        const data = await purchasesRes.json();
        setOwnedSkillIds(new Set(data.skills.map((s: { id: string }) => s.id)));
      }
    } catch (err) {
      console.error("Failed to buy skills:", err);
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1a1a1a]/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#f0ece2] border-2 border-[#1a1a1a] shadow-2xl max-w-xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-double border-[#1a1a1a]/30">
          <div>
            <h2 className="font-serif font-black text-2xl text-[#1a1a1a]">
              Copy {agentName}&apos;s Build?
            </h2>
            <p className="font-mono text-xs text-[#1a1a1a]/50 mt-1">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} in this build
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a]/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 size={24} className="mx-auto animate-spin text-[#1a1a1a]/40" />
              <p className="font-mono text-xs text-[#1a1a1a]/40 mt-2">
                Checking your deck...
              </p>
            </div>
          ) : (
            <>
              {/* Owned skills */}
              {ownedSkills.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Check size={14} className="text-green-700" />
                    <h3 className="font-mono text-xs uppercase tracking-wider text-green-700 font-bold">
                      You Own ({ownedSkills.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ownedSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-800/10 border border-green-800/20"
                      >
                        <span>{skill.icon}</span>
                        <span className="font-mono text-xs text-green-800">
                          {skill.name}
                        </span>
                        <Check size={12} className="text-green-700" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing skills */}
              {missingSkills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart size={14} className="text-[#b08d57]" />
                    <h3 className="font-mono text-xs uppercase tracking-wider text-[#b08d57] font-bold">
                      You Need ({missingSkills.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {missingSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between py-2 border-b border-dotted border-[#1a1a1a]/15 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{skill.icon}</span>
                          <div>
                            <div className="font-serif font-bold text-sm text-[#1a1a1a]">
                              {skill.name}
                            </div>
                            <div className="font-mono text-[10px] text-[#1a1a1a]/50">
                              {skill.category} · ★ {skill.rating.toFixed(1)}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-[#1a1a1a]">
                          ${skill.price.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All owned message */}
              {missingSkills.length === 0 && ownedSkills.length === skills.length && (
                <div className="text-center py-8">
                  <Check size={32} className="mx-auto text-green-700 mb-3" />
                  <p className="font-serif font-bold text-lg text-green-800">
                    You own all skills in this build!
                  </p>
                  <p className="font-mono text-xs text-[#1a1a1a]/50 mt-2">
                    Go to your deck to equip them to your agent.
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-[#dc2626]/10 border border-[#dc2626]/20">
                  <p className="font-mono text-xs text-[#dc2626]">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && missingSkills.length > 0 && (
          <div className="p-4 border-t-2 border-double border-[#1a1a1a]/30 bg-[#1a1a1a]/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-[#1a1a1a]/60">Total</span>
              <span className="font-serif font-black text-2xl text-[#1a1a1a]">
                ${totalCost.toFixed(0)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBuyAll}
                disabled={buying}
                className="flex-1 bg-[#1a1a1a] text-[#f0ece2] font-mono text-sm py-3 hover:bg-[#1a1a1a]/80 transition-colors tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {buying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    BUYING...
                  </>
                ) : authenticated ? (
                  <>
                    <ShoppingCart size={14} />
                    BUY ALL & COPY BUILD
                  </>
                ) : (
                  "SIGN IN TO BUY"
                )}
              </button>
              <button
                onClick={onClose}
                className="px-4 border-2 border-[#1a1a1a]/20 font-mono text-sm text-[#1a1a1a]/60 hover:border-[#1a1a1a]/40 hover:text-[#1a1a1a] transition-colors flex items-center gap-2"
              >
                <Heart size={14} />
                WISHLIST
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
