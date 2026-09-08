import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Editor for a food option inside a meal option group.
///
/// Food records are selected from the authenticated catalog. The server copies
/// nutrition into the plan option snapshot so an activated plan stays stable.
class DietFoodOptionEditorModal extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;
  final int groupId;
  final Map<String, dynamic>? existing;

  const DietFoodOptionEditorModal({
    super.key,
    required this.apiClient,
    required this.planId,
    required this.groupId,
    this.existing,
  });

  static Future<bool?> show(
    BuildContext context, {
    required ApiClient apiClient,
    required int planId,
    required int groupId,
    Map<String, dynamic>? existing,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DietFoodOptionEditorModal(
        apiClient: apiClient,
        planId: planId,
        groupId: groupId,
        existing: existing,
      ),
    );
  }

  @override
  State<DietFoodOptionEditorModal> createState() =>
      _DietFoodOptionEditorModalState();
}

class _DietFoodOptionEditorModalState
    extends State<DietFoodOptionEditorModal> {
  late final TextEditingController _searchCtrl;
  late final TextEditingController _labelCtrl;
  late final TextEditingController _quantityCtrl;
  late final TextEditingController _caloriesCtrl;
  late final TextEditingController _proteinCtrl;
  late final TextEditingController _carbsCtrl;
  late final TextEditingController _fatCtrl;
  late final TextEditingController _fiberCtrl;
  late final TextEditingController _notesCtrl;

  List<Map<String, dynamic>> _foods = [];
  Map<String, dynamic>? _selectedFood;
  int? _selectedFoodId;
  bool _loadingFoods = true;
  bool _saving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _searchCtrl = TextEditingController();
    _labelCtrl = TextEditingController(
      text: existing?['custom_label']?.toString() ??
          existing?['label']?.toString() ??
          '',
    );
    _quantityCtrl = TextEditingController(
      text: '${existing?['serving_quantity'] ?? existing?['quantity'] ?? ''}',
    );
    _caloriesCtrl = _numberController(
      existing?['calories'] ?? existing?['calories_snapshot'],
    );
    _proteinCtrl = _numberController(
      existing?['protein_g'] ?? existing?['protein_g_snapshot'],
    );
    _carbsCtrl = _numberController(
      existing?['carbs_g'] ?? existing?['carbs_g_snapshot'],
    );
    _fatCtrl = _numberController(
      existing?['fat_g'] ?? existing?['fat_g_snapshot'],
    );
    _fiberCtrl = _numberController(
      existing?['fiber_g'] ?? existing?['fiber_g_snapshot'],
    );
    _notesCtrl = TextEditingController(
      text: existing?['notes']?.toString() ?? '',
    );
    _selectedFoodId = _asInt(existing?['food_id'] ?? existing?['foodId']);
    _loadFoods();
  }

  TextEditingController _numberController(dynamic value) =>
      TextEditingController(text: value == null ? '' : '$value');

  @override
  void dispose() {
    _searchCtrl.dispose();
    _labelCtrl.dispose();
    _quantityCtrl.dispose();
    _caloriesCtrl.dispose();
    _proteinCtrl.dispose();
    _carbsCtrl.dispose();
    _fatCtrl.dispose();
    _fiberCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value');
  }

  double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value');
  }

  String _cleanError(Object error) =>
      error.toString().replaceAll('Exception: ', '').trim();

  Future<void> _loadFoods() async {
    try {
      final response = await widget.apiClient.get('/foods?limit=100');
      final raw = response is Map && response['data'] is List
          ? response['data'] as List
          : response is List
              ? response
              : const [];
      final foods = raw
          .whereType<Map>()
          .map((food) => Map<String, dynamic>.from(food))
          .where((food) => _asInt(food['id']) != null)
          .toList();

      Map<String, dynamic>? selected;
      for (final food in foods) {
        if (_asInt(food['id']) == _selectedFoodId) {
          selected = food;
          break;
        }
      }

      // Keep an existing plan editable if a catalog item was archived later.
      if (selected == null && _selectedFoodId != null) {
        selected = {
          'id': _selectedFoodId,
          'name': widget.existing?['food_name']?.toString() ??
              widget.existing?['custom_label']?.toString() ??
              'Saved food',
          'unit_code': widget.existing?['unit_code']?.toString(),
        };
        foods.insert(0, selected);
      }

      if (!mounted) return;
      setState(() {
        _foods = foods;
        _selectedFood = selected;
        _loadingFoods = false;
        _errorMessage = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loadingFoods = false;
          _errorMessage =
              'Unable to load the food catalog: ${_cleanError(error)}';
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredFoods {
    final query = _searchCtrl.text.trim().toLowerCase();
    if (query.isEmpty) return _foods;
    return _foods.where((food) {
      final name = food['name']?.toString().toLowerCase() ?? '';
      final brand = food['brand']?.toString().toLowerCase() ?? '';
      return name.contains(query) || brand.contains(query);
    }).toList();
  }

  void _selectFood(Map<String, dynamic> food) {
    final foodId = _asInt(food['id']);
    if (foodId == null) return;
    final previousFoodId = _selectedFoodId;
    setState(() {
      _selectedFood = food;
      _selectedFoodId = foodId;
      _errorMessage = null;
    });

    // New options start at the catalog reference serving. Existing snapshots
    // remain untouched when the editor is opened in edit mode.
    if (widget.existing == null || previousFoodId != foodId) {
      final referenceQuantity = _asDouble(
            food['reference_quantity'] ??
                food['referenceQuantity'] ??
                food['default_serving_amount'],
          ) ??
          100;
      _quantityCtrl.text = _formatNumber(referenceQuantity);
      _updateNutritionFields();
    }
  }

  void _updateNutritionFields() {
    final food = _selectedFood;
    final quantity = _asDouble(_quantityCtrl.text);
    if (food == null || quantity == null || quantity <= 0) return;
    final referenceQuantity = _asDouble(
          food['reference_quantity'] ??
              food['referenceQuantity'] ??
              food['default_serving_amount'],
        ) ??
        100;
    if (referenceQuantity <= 0) return;

    String scaled(String key) {
      final value = _asDouble(food[key]);
      if (value == null) return '';
      return _formatNumber(value * quantity / referenceQuantity);
    }

    setState(() {
      _caloriesCtrl.text = scaled('calories');
      _proteinCtrl.text = scaled('protein_g');
      _carbsCtrl.text = scaled('carbs_g');
      _fatCtrl.text = scaled('fat_g');
      _fiberCtrl.text = scaled('fiber_g');
    });
  }

  String _formatNumber(double value) {
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(1);
  }

  Future<void> _handleSave() async {
    final foodId = _selectedFoodId;
    final quantity = _asDouble(_quantityCtrl.text.trim());
    if (foodId == null) {
      setState(() => _errorMessage = 'Select a food before adding the option.');
      return;
    }
    if (quantity == null || quantity <= 0 || quantity > 10000) {
      setState(() => _errorMessage =
          'Enter a quantity between 0.01 and 10,000.');
      return;
    }

    final nutritionFields = <String, TextEditingController>{
      'calories': _caloriesCtrl,
      'protein': _proteinCtrl,
      'carbohydrates': _carbsCtrl,
      'fat': _fatCtrl,
      'fiber': _fiberCtrl,
    };
    for (final entry in nutritionFields.entries) {
      final text = entry.value.text.trim();
      if (text.isEmpty) continue;
      final value = _asDouble(text);
      final maximum = entry.key == 'calories' ? 10000 : 1000;
      if (value == null || value < 0 || value > maximum) {
        setState(() => _errorMessage =
            '${entry.key[0].toUpperCase()}${entry.key.substring(1)} must be between 0 and $maximum.');
        return;
      }
    }

    double? number(TextEditingController controller) {
      final text = controller.text.trim();
      if (text.isEmpty) return null;
      return _asDouble(text);
    }

    final unitId = _asInt(_selectedFood?['measurement_unit_id'] ??
        _selectedFood?['reference_unit_id'] ??
        _selectedFood?['measurementUnitId']);
    final calories = number(_caloriesCtrl);
    final protein = number(_proteinCtrl);
    final carbs = number(_carbsCtrl);
    final fat = number(_fatCtrl);
    final fiber = number(_fiberCtrl);
    final payload = <String, dynamic>{
      'foodId': foodId,
      'servingQuantity': quantity,
      'customLabel': _labelCtrl.text.trim(),
      if (unitId != null) 'servingUnitId': unitId,
      if (calories != null) 'calories': calories,
      if (protein != null) 'proteinG': protein,
      if (carbs != null) 'carbsG': carbs,
      if (fat != null) 'fatG': fat,
      if (fiber != null) 'fiberG': fiber,
      'notes': _notesCtrl.text.trim(),
    };

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    try {
      final optionId = _asInt(widget.existing?['id']);
      if (optionId == null) {
        await widget.apiClient.post(
          '/me/diet-plans/${widget.planId}/option-groups/${widget.groupId}/options',
          body: payload,
        );
      } else {
        await widget.apiClient.put(
          '/me/diet-plans/${widget.planId}/options/$optionId',
          body: payload,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _errorMessage = _cleanError(error);
        });
      }
    }
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    TextInputType keyboardType = TextInputType.text,
    String? hint,
  }) {
    return PremiumTextField(
      controller: controller,
      label: label,
      hint: hint,
      keyboardType: keyboardType,
      onChanged: label == 'Quantity' ? (_) => _updateNutritionFields() : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEditing = widget.existing != null;
    final filtered = _filteredFoods;
    final selectedName =
        _selectedFood?['name']?.toString() ?? 'No food selected';
    final unitName = _selectedFood?['unit_code']?.toString() ??
        _selectedFood?['unit_name']?.toString() ??
        'catalog unit';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.92,
      ),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 6),
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.borderHover,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.restaurant_menu, color: colors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isEditing ? 'Edit food option' : 'Add food option',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context, false),
                  icon: Icon(Icons.close, color: colors.textSecondary),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              children: [
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: colors.roseMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(
                          color: colors.rose.withValues(alpha: 0.5)),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: colors.rose, fontSize: 13),
                    ),
                  ),
                ],
                Text(
                  'FOOD CATALOG',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('food-search'),
                  controller: _searchCtrl,
                  onChanged: (_) => setState(() {}),
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    prefixIcon: Icon(Icons.search, color: colors.textMuted),
                    hintText: 'Search foods or brands',
                    filled: true,
                    fillColor: colors.surfaceElevated,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: BorderSide(color: colors.border),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                if (_loadingFoods)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (filtered.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Column(
                      children: [
                        Text(
                          _foods.isEmpty
                              ? 'No active foods are available.'
                              : 'No foods match your search.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textSecondary),
                        ),
                        if (_foods.isEmpty) ...[
                          const SizedBox(height: 8),
                          TextButton.icon(
                            onPressed: _loadFoods,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try again'),
                          ),
                        ],
                      ],
                    ),
                  )
                else
                  Container(
                    constraints: const BoxConstraints(maxHeight: 220),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.border),
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, color: colors.border),
                      itemBuilder: (_, index) {
                        final food = filtered[index];
                        final foodId = _asInt(food['id']);
                        final selected = foodId == _selectedFoodId;
                        final brand = food['brand']?.toString();
                        return ListTile(
                          dense: true,
                          selected: selected,
                          selectedTileColor: colors.primaryMuted,
                          leading: Icon(
                            selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: selected ? colors.primary : colors.textMuted,
                          ),
                          title: Text(
                            food['name']?.toString() ?? 'Food',
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          subtitle: Text(
                            brand == null || brand.isEmpty
                                ? '${food['calories'] ?? '-'} kcal per reference serving'
                                : '$brand • ${food['calories'] ?? '-'} kcal',
                            style: TextStyle(color: colors.textSecondary),
                          ),
                          onTap: () => _selectFood(food),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.primaryMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                        color: colors.primary.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle_outline, color: colors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$selectedName • $unitName',
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _field(
                  label: 'Custom label (optional)',
                  controller: _labelCtrl,
                  hint: 'e.g. Grilled chicken breast',
                ),
                const SizedBox(height: 12),
                _field(
                  label: 'Quantity',
                  controller: _quantityCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  hint: 'e.g. 150',
                ),
                const SizedBox(height: 14),
                Text(
                  'NUTRITION SNAPSHOT',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _field(
                        label: 'Calories (kcal)',
                        controller: _caloriesCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _field(
                        label: 'Protein (g)',
                        controller: _proteinCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _field(
                        label: 'Carbs (g)',
                        controller: _carbsCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _field(
                        label: 'Fat (g)',
                        controller: _fatCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _field(
                  label: 'Fiber (g, optional)',
                  controller: _fiberCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 12),
                _field(
                  label: 'Food notes / preparation',
                  controller: _notesCtrl,
                  hint: 'e.g. Weigh cooked, remove skin',
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              20,
              12,
              20,
              MediaQuery.of(context).viewInsets.bottom + 16,
            ),
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border(top: BorderSide(color: colors.border)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: PremiumButton(
                    text: 'Cancel',
                    isSecondary: true,
                    onPressed: () => Navigator.pop(context, false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: PremiumButton(
                    text: isEditing ? 'Save changes' : 'Add food',
                    loading: _saving,
                    onPressed: _handleSave,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
