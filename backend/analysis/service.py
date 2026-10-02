import pandas as pd
import numpy as np
import statsmodels.api as sm
from statsmodels.formula.api import ols
from scipy import stats

class StatisticalEngine:
    @staticmethod
    def analyze(df: pd.DataFrame, response_col: str, factors: list, model_type: str, transformation: str = "NONE"):
        # Handle transformations
        y = df[response_col].copy()
        if transformation == "LOG":
            y = np.log10(y)
        elif transformation == "SQRT":
            y = np.sqrt(y)
        elif transformation == "INVERSE":
            y = 1 / y
        
        df["_Y"] = y
        
        # Build formula
        formula_terms = []
        factor_cols = [f.code for f in factors]
        
        if model_type == "FIRST_ORDER":
            formula_terms = factor_cols
        elif model_type == "INTERACTIONS":
            formula_terms = factor_cols.copy()
            for i in range(len(factor_cols)):
                for j in range(i+1, len(factor_cols)):
                    formula_terms.append(f"{factor_cols[i]}:{factor_cols[j]}")
        elif model_type == "QUADRATIC":
            formula_terms = factor_cols.copy()
            for i in range(len(factor_cols)):
                for j in range(i+1, len(factor_cols)):
                    formula_terms.append(f"{factor_cols[i]}:{factor_cols[j]}")
            for col in factor_cols:
                formula_terms.append(f"np.power({col}, 2)")
                
        formula = f"_Y ~ " + " + ".join(formula_terms)
        
        try:
            model = ols(formula, data=df).fit()
        except Exception as e:
            raise ValueError(f"Model not estimable: {str(e)}")
            
        # Coefficients
        coefs = []
        for term in model.params.index:
            coef_val = float(model.params[term]) if pd.notna(model.params[term]) else 0.0
            se_val = float(model.bse[term]) if pd.notna(model.bse[term]) else None
            t_val = float(model.tvalues[term]) if pd.notna(model.tvalues[term]) else None
            p_val = float(model.pvalues[term]) if pd.notna(model.pvalues[term]) else None
            ci_low_val = float(model.conf_int().loc[term][0]) if pd.notna(model.conf_int().loc[term][0]) else None
            ci_high_val = float(model.conf_int().loc[term][1]) if pd.notna(model.conf_int().loc[term][1]) else None

            coefs.append({
                "term": str(term),
                "coef": coef_val,
                "se": se_val,
                "std_err": se_val,
                "t": t_val,
                "t_stat": t_val,
                "p": p_val,
                "p_value": p_val,
                "ci_low": ci_low_val,
                "ci_lower": ci_low_val,
                "ci_high": ci_high_val,
                "ci_upper": ci_high_val
            })
            
        # ANOVA
        try:
            anova_table = sm.stats.anova_lm(model, typ=2)
            anova_res = []
            for idx, row in anova_table.iterrows():
                sum_sq = float(row.get("sum_sq")) if pd.notna(row.get("sum_sq")) else None
                df_val = float(row.get("df")) if pd.notna(row.get("df")) else None
                mean_sq = (sum_sq / df_val) if (sum_sq is not None and df_val) else None
                f_val = float(row.get("F")) if pd.notna(row.get("F")) else None
                p_val = float(row.get("PR(>F)")) if pd.notna(row.get("PR(>F)")) else None

                anova_res.append({
                    "source": str(idx),
                    "df": df_val,
                    "sum_sq": sum_sq,
                    "mean_sq": mean_sq,
                    "F": f_val,
                    "PR(>F)": p_val,
                    "p_value": p_val
                })
        except Exception:
            anova_res = []

        # Lack of fit
        # Check if we have replicates
        grouped = df.groupby(factor_cols)["_Y"].apply(list)
        replicates_exist = any(len(g) > 1 for g in grouped)
        
        lof_result = {"status": "NOT_TESTABLE"}
        
        if replicates_exist:
            try:
                # Calculate Pure Error SS (SSPE)
                sspe = 0
                df_pe = 0
                for g in grouped:
                    if len(g) > 1:
                        sspe += np.sum((np.array(g) - np.mean(g))**2)
                        df_pe += len(g) - 1
                        
                # SS Residual
                ss_res = model.ssr
                df_res = model.df_resid
                
                # SS Lack of Fit
                ss_lof = ss_res - sspe
                df_lof = df_res - df_pe
                
                if df_lof > 0 and df_pe > 0:
                    ms_lof = ss_lof / df_lof
                    ms_pe = sspe / df_pe
                    f_lof = ms_lof / ms_pe
                    p_lof = 1.0 - stats.f.cdf(f_lof, df_lof, df_pe)
                    lof_result = {
                        "status": "TESTABLE",
                        "sum_sq": ss_lof,
                        "df": df_lof,
                        "mean_sq": ms_lof,
                        "F": f_lof,
                        "p_value": p_lof
                    }
            except Exception:
                pass
                
        # PRESS and Predicted R-squared
        metrics = {}
        try:
            # PRESS = sum( (residuals / (1 - leverage))**2 )
            influence = model.get_influence()
            leverage = influence.hat_matrix_diag
            press = np.sum((model.resid / (1 - leverage))**2)
            
            # SS Total = model.centered_tss
            pred_r_squared = 1 - (press / model.centered_tss)
            metrics["press"] = press
            metrics["pred_r_squared"] = pred_r_squared
        except Exception:
            pass

        metrics["r_squared"] = model.rsquared
        metrics["adj_r_squared"] = model.rsquared_adj
        metrics["rmse"] = np.sqrt(model.mse_resid)
        metrics["lack_of_fit"] = lof_result
        
        # Diagnostics
        resid = model.resid
        fitted = model.fittedvalues
        
        # Shapiro-Wilk for normality
        shapiro_stat, shapiro_p = stats.shapiro(resid)
        normality_status = "PASS" if shapiro_p > 0.05 else "WARNING"
        
        diagnostics = {
            "normality": {
                "status": normality_status,
                "shapiro_p": shapiro_p
            },
            "residuals": resid.tolist(),
            "fitted": fitted.tolist(),
            "actual": y.tolist(),
            "leverage": leverage.tolist() if 'leverage' in locals() else [],
            "studentized_residuals": influence.resid_studentized_internal.tolist() if 'influence' in locals() else [],
            "cooks_distance": influence.cooks_distance[0].tolist() if 'influence' in locals() else []
        }
        
        return {
            "coefficients": coefs,
            "anova": anova_res,
            "metrics": metrics,
            "diagnostics": diagnostics
        }
