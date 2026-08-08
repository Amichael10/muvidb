import json

input_file = r"C:\Users\User\.gemini\antigravity\brain\de833698-2c8f-43e1-bd7e-32069e8ea801\agent2_extracted_verdicts.json"
output_md = r"C:\Users\User\.gemini\antigravity\brain\de833698-2c8f-43e1-bd7e-32069e8ea801\nigerian_critics_verdicts_report.md"

with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Group by critic
by_critic = {}
for item in data:
    c = item["critic"]
    if c not in by_critic:
        by_critic[c] = []
    by_critic[c].append(item)

md = []
md.append("# 🎬 Full MuviDB Nigerian Critics Verdict & Review Index\n")
md.append("This document synthesizes reviews and critical verdicts across 31 Nollywood movie reviews from prominent Nigerian film critics.\n")
md.append("---\n")

md.append("## 📊 Summary Overview\n")
md.append(f"- **Total Critics Analyzed**: {len(by_critic)}")
md.append(f"- **Total Movie Reviews**: {len(data)}")
md.append("- **Key Critics Included**: Tolu Fagbure, Iroko Critic (Mr C & Mrs C), Victor Salami (Marapolsa Movies), Oris Aigbokhaevbolo (Film Efiko), Seyi Lasisi (Afrocritik), Joseph Jonathan (Afrocritik), Halimah Yusuf (Halimah Thebird)\n")
md.append("---\n")

for critic_name, reviews in by_critic.items():
    platform = reviews[0]["platform"]
    handle = reviews[0]["handle"]
    md.append(f"## 👤 Critic: **{critic_name}** ({platform} `{handle}`)\n")
    md.append("| # | Film Title | Year | Rating | Sentiment | Verdict Summary | Review Link |")
    md.append("|---|---|---|---|---|---|---|")
    for r in reviews:
        link_str = f"[Read Review]({r['review_url']})" if r['review_url'] else "N/A"
        rating_str = f"⭐ {r['rating']}" if r['rating'] != "Unrated" else "Unrated"
        badge = "🟢 POSITIVE" if r['sentiment'] == "POSITIVE" else ("🔴 NEGATIVE" if r['sentiment'] == "NEGATIVE" else "🟡 MIXED")
        md.append(f"| {r['id']} | **{r['movie']}** | {r['year']} | {rating_str} | {badge} | {r['verdict_statement']} | {link_str} |")
    md.append("\n---\n")

with open(output_md, "w", encoding="utf-8") as f:
    f.write("\n".join(md))

print(f"Agent 3 Formatted presentation saved to {output_md}")
