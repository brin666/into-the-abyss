# Into the Abyss — 资产来源与积分记录

本文件只记录能从当前项目文件和对话中核对的事实。**报价、确认执行、任务成功和实际扣费是不同事件**；没有服务端扣费明细时，实际积分标为未核实。

| 资产 | 来源与版本 | 当前用途 | 报价/授权记录 | 实际 Lux3D 扣费 |
|---|---|---|---|---|
| 渔夫原始模型 | Lux3D 中国站 G1-Turbo，任务 `3903296`；后续本地 Blender 骨骼与动作 | v10 组合船的角色来源 | 首批四模型合计报价 52 积分，经用户确认 | 单项未核实；交付清单 `actualCredits: unavailable` |
| 小型鱼原始模型 | Lux3D 中国站 G1-Turbo，任务 `3903303`；后续优化 | 0–40m 饵鱼群 | 同上 | 单项未核实 |
| 绿海龟原始模型 | Lux3D 中国站 G1-Turbo，成功任务 `3903328`；先前一次提交被拒 | 0–40m 海龟 | 同上 | 单项未核实；被拒尝试不记作成功生成 |
| 月亮水母原始模型 | Lux3D 中国站 G1-Turbo，任务 `3903340`；后续优化 | 24–32m 三只克隆 | 同上 | 单项未核实 |
| 船原始模型 | Lux3D 中国站生成的 `lux3d-delivery/into-the-abyss-vessel-20261003/models/boat.glb` | v10 组合船的船体来源 | 单独一批报价 13 积分，经用户确认 | 本目录没有可核对的任务扣费明细，未核实 |
| 船与渔夫组合 v01–v11 | 本地 Blender；v10 校正竿尖轨迹，v11 使用 `tools/blender/refine_vessel_grip_v11.py` 调整手掌接触 | 当前页面加载 v11 GLB | 不需要新的 Lux3D 报价 | 本地修正 0 积分 |
| 翻车鱼 study/v2/v3/v4 | 本地 Blender；v4 使用 `tools/blender/refine_sunfish_v4.py` | 40–80m 当前模型 v4 | 不需要 Lux3D 报价 | 本地制作 0 积分 |
| 大青鲨 study/v2 | 本地 Blender；v2 使用 `tools/blender/refine_shark_v2.py` | 40–80m 当前模型 v2 | 不需要 Lux3D 报价 | 本地制作 0 积分 |

四只初批模型的任务编号及 `actualCredits` 状态来自 `lux3d-delivery/into-the-abyss-creatures-20261002/bundle/lux3d-delivery.json`。船的 13 积分和首批 52 积分是对话中的**报价及执行确认**，不能据此推断精确实际扣费总数。后续若取得服务端账单或生成任务回执，再补充核验值；不得用当前余额反推单个旧任务的费用。
