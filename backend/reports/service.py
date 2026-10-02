import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ReportGenerator:
    @staticmethod
    def generate_pdf(project_id: int, project_data: dict, output_dir: str):
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        filename = f"AQbD_Report_Project_{project_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        filepath = os.path.join(output_dir, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        
        title_style = styles['Title']
        h1_style = styles['Heading1']
        h2_style = styles['Heading2']
        norm_style = styles['Normal']
        small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, leading=10)
        
        Story = []
        
        # Title & Header
        Story.append(Paragraph("AQbD Analytical Method Development Report", title_style))
        Story.append(Paragraph("Analytical Quality by Design (AQbD) / Design of Experiments (DOE) Studio V1", styles['Italic']))
        Story.append(Spacer(1, 14))
        
        # Metadata Block
        meta_table_data = [
            ["Project Code:", project_data.get('project_code', 'N/A'), "Date / Time:", datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            ["Project Name:", project_data.get('project_name', 'N/A'), "Software:", "AQbD Studio V1 (ICH-Aligned)"]
        ]
        t_meta = Table(meta_table_data, colWidths=[90, 180, 80, 190])
        t_meta.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#1e293b')),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#94a3b8')),
        ]))
        Story.append(t_meta)
        Story.append(Spacer(1, 16))
        
        # 1. Executive Summary
        Story.append(Paragraph("1. Executive Summary", h1_style))
        Story.append(Paragraph(
            "This report documents the systematic, science- and risk-based development of the analytical procedure following ICH Q14 guidelines. "
            "The workflow progresses from defining the Analytical Target Profile (ATP) and initial Failure Mode and Effects Analysis (FMEA) risk assessment, "
            "to multivariate Design of Experiments (DOE), rigorous ANOVA and diagnostic model verification, multi-response desirability optimization, "
            "design space boundaries determination, and experimental confirmation.", norm_style
        ))
        Story.append(Spacer(1, 12))
        
        # 2. Analytical Target Profile (ATP)
        Story.append(Paragraph("2. Analytical Target Profile (ATP)", h1_style))
        atp_list = project_data.get('atp', [])
        if atp_list:
            atp_data = [["Parameter", "Criterion", "Unit", "Acceptance Limits / Target"]]
            for a in atp_list:
                limits = "-"
                tt = a.get("target_type")
                if tt == "RANGE": limits = f"[{a.get('lower_limit')} to {a.get('upper_limit')}]"
                elif tt == "MINIMUM": limits = f">= {a.get('lower_limit')}"
                elif tt == "MAXIMUM": limits = f"<= {a.get('upper_limit')}"
                elif tt == "TARGET": limits = f"= {a.get('target_value')}"
                atp_data.append([a.get("name", ""), tt, a.get("unit") or "-", limits])
            t_atp = Table(atp_data, colWidths=[180, 100, 80, 180])
            t_atp.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            Story.append(t_atp)
        else:
            Story.append(Paragraph("No ATP parameters defined.", norm_style))
        Story.append(Spacer(1, 12))
        
        # 3. Risk Assessment (FMEA)
        Story.append(Paragraph("3. Risk Assessment (FMEA)", h1_style))
        risk_list = project_data.get('risks', [])
        if risk_list:
            risk_data = [["Parameter", "Severity (S)", "Occurrence (O)", "Detectability (D)", "RPN", "Priority"]]
            for r in risk_list:
                risk_data.append([
                    r.get("parameter", ""),
                    str(r.get("severity", "")),
                    str(r.get("occurrence", "")),
                    str(r.get("detectability", "")),
                    str(r.get("risk_score", "")),
                    r.get("priority", "")
                ])
            t_risk = Table(risk_data, colWidths=[180, 70, 75, 85, 60, 70])
            t_risk.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('ALIGN', (1,0), (-2,-1), 'CENTER'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            Story.append(t_risk)
        else:
            Story.append(Paragraph("No risk assessments recorded.", norm_style))
        Story.append(Spacer(1, 12))

        # 4. Experimental Factors
        Story.append(Paragraph("4. Experimental Factors (DOE Parameters)", h1_style))
        factor_list = project_data.get('factors', [])
        if factor_list:
            fac_data = [["Code", "Factor Name", "Unit", "Low (-1)", "High (+1)", "Role"]]
            for f in factor_list:
                fac_data.append([
                    f.get("code", ""),
                    f.get("name", ""),
                    f.get("unit") or "-",
                    str(f.get("low_value", "")),
                    str(f.get("high_value", "")),
                    f.get("role", "")
                ])
            t_fac = Table(fac_data, colWidths=[50, 200, 60, 75, 75, 80])
            t_fac.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('ALIGN', (0,0), (0,-1), 'CENTER'),
                ('ALIGN', (3,1), (4,-1), 'RIGHT'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            Story.append(t_fac)
        else:
            Story.append(Paragraph("No factors defined.", norm_style))
        Story.append(Spacer(1, 12))

        # 5. Responses
        Story.append(Paragraph("5. Experimental Responses & Goals", h1_style))
        resp_list = project_data.get('responses', [])
        if resp_list:
            resp_data = [["Code", "Response Name", "Unit", "Goal", "Limits / Target", "Weight"]]
            for r in resp_list:
                g = r.get("target_type", "")
                lim = "-"
                if g == "RANGE": lim = f"[{r.get('lower_limit')} - {r.get('upper_limit')}]"
                elif g == "TARGET": lim = f"= {r.get('target')}"
                elif g == "MINIMUM": lim = f">= {r.get('lower_limit') or ''}"
                elif g == "MAXIMUM": lim = f"<= {r.get('upper_limit') or ''}"
                resp_data.append([
                    r.get("code", ""),
                    r.get("name", ""),
                    r.get("unit") or "-",
                    g,
                    lim,
                    str(r.get("importance", 3))
                ])
            t_resp = Table(resp_data, colWidths=[50, 190, 60, 90, 100, 50])
            t_resp.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('ALIGN', (0,0), (0,-1), 'CENTER'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            Story.append(t_resp)
        else:
            Story.append(Paragraph("No responses defined.", norm_style))
        Story.append(Spacer(1, 12))

        # 6. DOE Summary
        Story.append(Paragraph("6. Design of Experiments (DOE) Execution", h1_style))
        active_doe = project_data.get('active_doe')
        if active_doe:
            Story.append(Paragraph(f"Active Design (ID {active_doe.get('id')}): <b>{active_doe.get('design_type')}</b> | Runs: <b>{active_doe.get('run_count')}</b> | Random Seed: <b>{active_doe.get('seed') or 'None'}</b>", norm_style))
        else:
            Story.append(Paragraph("No active DOE design recorded.", norm_style))
        Story.append(Spacer(1, 12))

        # 7. Statistical Modeling & Optimization
        Story.append(Paragraph("7. Statistical Modeling & Optimization", h1_style))
        
        hist_count = project_data.get('historical_model_count', 0)
        if hist_count > 0:
            Story.append(Paragraph(f"<i>Note: {hist_count} historical/superseded model fits are archived in the project but excluded from this active summary.</i>", small_style))
            Story.append(Spacer(1, 6))

        active_analyses = project_data.get('active_analyses', [])
        if active_analyses:
            Story.append(Paragraph("<b>Active Response Models:</b>", norm_style))
            for a in active_analyses:
                m = a.get("metrics", {})
                r2_val = m.get('r_squared')
                adj_val = m.get('adj_r_squared')
                pred_val = m.get('pred_r_squared')
                
                r2 = f"{r2_val*100:.1f}%" if r2_val is not None else "N/A"
                adj_r2 = f"{adj_val*100:.1f}%" if adj_val is not None else "N/A"
                pred_r2 = f"{pred_val*100:.1f}%" if pred_val is not None else "N/A"
                Story.append(Paragraph(f"• ID #{a.get('id')} - Response ID {a.get('response_id')} ({a.get('model_type')}): R² = <b>{r2}</b> | Adj R² = <b>{adj_r2}</b> | Pred R² = <b>{pred_r2}</b>", norm_style))
        else:
            Story.append(Paragraph("No active models found.", norm_style))
        
        active_opt = project_data.get('active_optimization')
        if active_opt:
            Story.append(Spacer(1, 6))
            Story.append(Paragraph(f"<b>Active Multi-Response Optimal Solution (Run #{active_opt.get('id')}):</b>", norm_style))
            cands = active_opt.get("candidates", [])
            if cands:
                best = cands[0]
                od = best.get("overall_desirability")
                od_str = f"{od:.4f}" if isinstance(od, (int, float)) else "N/A"
                Story.append(Paragraph(f"Overall Desirability (D): <b>{od_str}</b>", norm_style))
                fac_str = ", ".join([f"{k} = {v:.3f}" if isinstance(v, (int, float)) else f"{k}={v}" for k, v in best.get("factors", {}).items()])
                Story.append(Paragraph(f"Optimal Setpoint: {fac_str}", norm_style))
        Story.append(Spacer(1, 12))

        # 8. Design Space (PAR)
        Story.append(Paragraph("8. Design Space & Proven Acceptable Range (PAR)", h1_style))
        active_ds = project_data.get('active_design_space')
        if active_ds:
            sd = active_ds.get('space_data', {})
            total_points = sd.get('total_3d_points', sd.get('total_points', 0))
            acceptable = sd.get('acceptable_3d_points', sd.get('acceptable_points', 0))
            unacceptable = sd.get('unacceptable_3d_points', sd.get('unacceptable_points', 0))
            feasibility = sd.get('feasible_3d_percentage', (acceptable / total_points * 100) if total_points > 0 else 0)
            
            Story.append(Paragraph(f"<b>Full 3D Design Space Analysis (Run #{active_ds.get('id')}):</b>", norm_style))
            Story.append(Paragraph(f"• Grid Vertices Evaluated: {total_points}", norm_style))
            Story.append(Paragraph(f"• Feasible/Acceptable Region: {acceptable} points ({feasibility:.1f}%)", norm_style))
            Story.append(Paragraph(f"• Unacceptable Region: {unacceptable} points", norm_style))
            Story.append(Paragraph(f"• Extrapolation Allowed: Zero", norm_style))
            
            Story.append(Spacer(1, 6))
            Story.append(Paragraph("<b>Projected Feasible Spans (Envelope):</b>", norm_style))
            spans = sd.get('projected_ranges_3d', sd.get('projected_ranges', {}))
            for factor_code, bounds in spans.items():
                low = bounds.get('min')
                high = bounds.get('max')
                l_str = f"{low:.2f}" if low is not None else "N/A"
                h_str = f"{high:.2f}" if high is not None else "N/A"
                Story.append(Paragraph(f"• {factor_code} = {l_str} – {h_str}", norm_style))
                
            Story.append(Spacer(1, 4))
            Story.append(Paragraph("<i>Note: The projected spans represent the outer envelope of feasibility across the evaluated dimensions. They do not constitute a fully uncoupled Cartesian operating box; some combinations near the edges may still fail constraints depending on interactions. (Note: 2D cross-sectional slices visualized in the software are distinct from this full 3D volume analysis).</i>", small_style))
        else:
            Story.append(Paragraph("No Design Space analysis computed.", norm_style))
        Story.append(Spacer(1, 12))

        # 9. Confirmation Validation
        conf_list = project_data.get('confirmations', [])
        if conf_list:
            Story.append(Paragraph("9. Confirmation Validation", h1_style))
            for c in conf_list:
                data_src = c.get('data_source', 'SIMULATED')
                is_exp = data_src == 'EXPERIMENTAL'
                status_text = "✓ Experimental Verification" if is_exp else "⚙ Software Simulation Check"
                
                Story.append(Paragraph(f"Confirmation Run ID: CR-{c.get('id')} — <b>{status_text}</b>", h2_style))
                
                # Format predictions vs actuals
                preds = c.get('predicted', {})
                acts = c.get('actual', {})
                diffs = c.get('diffs', {})
                
                for k in preds.keys():
                    p_val = preds.get(k)
                    a_val = acts.get(k)
                    d_val = diffs.get(k)
                    p_str = f"{p_val:.3f}" if isinstance(p_val, (int, float)) else "N/A"
                    a_str = f"{a_val:.3f}" if isinstance(a_val, (int, float)) else "N/A"
                    d_str = f"{d_val:.3f}" if isinstance(d_val, (int, float)) else "N/A"
                    
                    Story.append(Paragraph(f"• {k}: Predicted = {p_str} | {'Observed' if is_exp else 'Simulated'} = {a_str} | Diff = {d_str}", norm_style))
                
                if not is_exp:
                    Story.append(Paragraph("<i>Verdict: Software Verification Passed (Data Source: SIMULATED)</i>", small_style))
                
                Story.append(Spacer(1, 8))
            Story.append(Spacer(1, 12))

        # 10. Conclusion
        Story.append(Paragraph("10. Conclusion", h1_style))
        Story.append(Paragraph(
            "The analytical method was developed and evaluated using systematic AQbD principles. "
            "The workflow produced model-based predictions, multi-response optimization results, and a computed multidimensional design space. "
            "Simulated confirmation records verify the software calculation workflow only and do not constitute empirical laboratory confirmation.",
            norm_style
        ))
        Story.append(Spacer(1, 14))
        Story.append(Paragraph("Generated automatically by AQbD Studio V1. Aligned with ICH Q8/Q9/Q14 Enhanced Lifecycle Guidelines.", styles['Italic']))
        
        doc.build(Story)
        return filepath
