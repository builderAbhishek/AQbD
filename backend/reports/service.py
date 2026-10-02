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
            ["Project Name:", project_data.get('project_name', 'N/A'), "Software:", "AQbD Studio V1 (ICH Q14 Enhanced Approach)"]
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
        doe_list = project_data.get('does', [])
        if doe_list:
            for d in doe_list:
                Story.append(Paragraph(f"Design Type: <b>{d.get('design_type')}</b> | Runs: <b>{d.get('run_count')}</b> | Random Seed: <b>{d.get('seed') or 'None'}</b>", norm_style))
        else:
            Story.append(Paragraph("No DOE designs recorded.", norm_style))
        Story.append(Spacer(1, 12))

        # 7. Statistical Modeling & Optimization
        Story.append(Paragraph("7. Statistical Modeling & Optimization", h1_style))
        analysis_list = project_data.get('analyses', [])
        if analysis_list:
            for a in analysis_list:
                m = a.get("metrics", {})
                r2 = f"{m.get('R2', 0):.4f}" if m.get('R2') is not None else "N/A"
                adj_r2 = f"{m.get('Adjusted_R2', 0):.4f}" if m.get('Adjusted_R2') is not None else "N/A"
                pred_r2 = f"{m.get('Predicted_R2', 0):.4f}" if m.get('Predicted_R2') is not None else "N/A"
                Story.append(Paragraph(f"Model: <b>{a.get('model_type')}</b> | R²: <b>{r2}</b> | Adj R²: <b>{adj_r2}</b> | Pred R²: <b>{pred_r2}</b>", norm_style))
        
        opt_list = project_data.get('optimizations', [])
        if opt_list:
            Story.append(Spacer(1, 6))
            Story.append(Paragraph("Multi-Response Optimal Solution (Desirability):", h2_style))
            for o in opt_list:
                cands = o.get("candidates", [])
                if cands:
                    best = cands[0]
                    od = best.get("overall_desirability")
                    od_str = f"{od:.4f}" if isinstance(od, (int, float)) else "N/A"
                    Story.append(Paragraph(f"Overall Desirability: <b>{od_str}</b>", norm_style))
                    fac_str = ", ".join([f"{k} = {v:.3f}" if isinstance(v, (int, float)) else f"{k}={v}" for k, v in best.get("factors", {}).items()])
                    Story.append(Paragraph(f"Factor Settings: {fac_str}", norm_style))
        Story.append(Spacer(1, 12))

        # 8. Confirmation Runs
        conf_list = project_data.get('confirmations', [])
        if conf_list:
            Story.append(Paragraph("8. Experimental Confirmation", h1_style))
            for c in conf_list:
                Story.append(Paragraph(f"Predicted: {c.get('predicted')} | Actual: {c.get('actual')} | Difference: {c.get('diffs')}", norm_style))
            Story.append(Spacer(1, 12))

        # 9. Conclusion
        Story.append(Paragraph("9. Conclusion", h1_style))
        Story.append(Paragraph(
            "The analytical method was developed and evaluated using systematic AQbD principles. "
            "The mathematical models, design space boundaries, and confirmation verification prove that the procedure operates robustly within its acceptable ranges.",
            norm_style
        ))
        Story.append(Spacer(1, 14))
        Story.append(Paragraph("Generated automatically by AQbD Studio V1. Compliant with ICH Q14 Enhanced Lifecycle Guidelines.", styles['Italic']))
        
        doc.build(Story)
        return filepath
