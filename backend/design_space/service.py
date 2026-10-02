import numpy as np
from optimization.service import OptimizationEngine

class DesignSpaceEngine:
    @staticmethod
    def calculate_space(factors, models_data, constraints, resolution=20):
        # We need to filter factors down to up to 3 for a basic visual grid, or just use the first two
        if not factors:
            return {"acceptable_points": 0, "unacceptable_points": 0, "plot_data": []}
            
        plot_factors = factors[:2]
        grids = []
        for f in plot_factors:
            grids.append(np.linspace(f.low_value, f.high_value, resolution))
            
        if len(plot_factors) == 1:
            mesh = np.meshgrid(grids[0])
            flat_mesh = [m.flatten() for m in mesh]
        else:
            mesh = np.meshgrid(grids[0], grids[1])
            flat_mesh = [m.flatten() for m in mesh]
            
        acceptable = 0
        unacceptable = 0
        plot_data = []
        
        for i in range(len(flat_mesh[0])):
            # Construct factor dict for the point
            fv = {}
            for j, f in enumerate(plot_factors):
                fv[f.code] = flat_mesh[j][i]
                
            # For unplotted factors, keep them at center
            for f in factors[len(plot_factors):]:
                fv[f.code] = (f.low_value + f.high_value) / 2.0
                
            is_acceptable = True
            for md in models_data:
                pred = OptimizationEngine._predict(factors, fv, md["coefs"], md["model_type"], md["transformation"])
                d = OptimizationEngine.calculate_desirability(
                    pred,
                    md["target_type"],
                    md.get("lower_limit"),
                    md.get("upper_limit"),
                    target=md.get("target"),
                    importance=3.0
                )
                if d <= 0.05: # Arbitrary threshold for "acceptable"
                    is_acceptable = False
                    break
                    
            if is_acceptable:
                acceptable += 1
            else:
                unacceptable += 1
                
            point_data = {"factors": fv, "acceptable": is_acceptable}
            plot_data.append(point_data)
            
        return {
            "acceptable_points": acceptable,
            "unacceptable_points": unacceptable,
            "plot_data": plot_data
        }
