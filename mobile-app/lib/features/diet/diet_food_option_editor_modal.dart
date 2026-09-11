import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Editor for a food option inside a meal option group.
///
/// Supports selecting from the authenticated food catalog OR directly entering
/// custom food items with customizable portions, measurement units, and macro snapshots.
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
  int _selectedUnitId = 1;
  String _selectedUnitName = 'g';
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
    _labelCtrl.addListener(() {
      if (mounted) setState(() {});
    });

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
    _selectedUnitId = _asInt(existing?['unit_id'] ?? existing?['serving_unit_id']) ?? 1;

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
    setState(() {
      _loadingFoods = true;
      _errorMessage = null;
    });

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
              widget.existing?['label']?.toString() ??
              'Saved food',
          'unit_code': widget.existing?['unit_code']?.toString() ?? 'g',
        };
        foods.insert(0, selected);
      }

      if (selected != null) {
        final unitId = _asInt(selected['measurement_unit_id'] ??
            selected['reference_unit_id'] ??
            selected['measurementUnitId']);
        if (unitId != null) {
          _selectedUnitId = unitId;
        }
        _selectedUnitName = selected['unit_code']?.toString() ??
            selected['unit_name']?.toString() ??
            'g';
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
    final unitId = _asInt(food['measurement_unit_id'] ??
        food['reference_unit_id'] ??
        food['measurementUnitId']) ?? 1;
    final unitCode = food['unit_code']?.toString() ??
        food['unit_name']?.toString() ??
        'g';

    setState(() {
      _selectedFood = food;
      _selectedFoodId = foodId;
      _selectedUnitId = unitId;
      _selectedUnitName = unitCode;
      _errorMessage = null;
    });

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

  void _clearSelectedFood() {
    setState(() {
      _selectedFood = null;
      _selectedFoodId = null;
    });
  }

  void _useSearchAsCustomFood() {
    final query = _searchCtrl.text.trim();
    if (query.isNotEmpty) {
      setState(() {
        _selectedFood = null;
        _selectedFoodId = null;
        _labelCtrl.text = query;
        if (_quantityCtrl.text.trim().isEmpty) {
          _quantityCtrl.text = '100';
        }
      });
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
    final customLabel = _labelCtrl.text.trim();
    final quantity = _asDouble(_quantityCtrl.text.trim());

    if (foodId == null && customLabel.isEmpty) {
      setState(() => _errorMessage =
          'Please select a food from the catalog or enter a food name/label.');
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

    final calories = number(_caloriesCtrl);
    final protein = number(_proteinCtrl);
    final carbs = number(_carbsCtrl);
    final fat = number(_fatCtrl);
    final fiber = number(_fiberCtrl);

    final resolvedLabel = customLabel.isNotEmpty
        ? customLabel
        : (_selectedFood?['name']?.toString() ?? 'Food Option');

    final payload = <String, dynamic>{
      if (foodId != null) 'foodId': foodId,
      'customLabel': resolvedLabel,
      'servingQuantity': quantity,
      'servingUnitId': _selectedUnitId,
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
      onChanged: label.startsWith('Quantity') ? (_) => _updateNutritionFields() : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEditing = widget.existing != null;
    final filtered = _filteredFoods;
    final hasCatalogSelection = _selectedFood != null;
    final hasCustomName = _labelCtrl.text.trim().isNotEmpty;
    final unitName = _selectedFood?['unit_code']?.toString() ??
        _selectedFood?['unit_name']?.toString() ??
        _selectedUnitName;

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
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        Text(
                          _foods.isEmpty
                              ? 'No catalog foods loaded. You can directly enter your custom food below.'
                              : 'No catalog foods match "${_searchCtrl.text.trim()}".',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13),
                        ),
                        if (_searchCtrl.text.trim().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: _useSearchAsCustomFood,
                            icon: const Icon(Icons.add_circle_outline, size: 16),
                            label: Text('Use "${_searchCtrl.text.trim()}" as custom food'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: colors.primary,
                              foregroundColor: colors.onPrimary,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            ),
                          ),
                        ] else if (_foods.isEmpty) ...[
                          const SizedBox(height: 8),
                          TextButton.icon(
                            onPressed: _loadFoods,
                            icon: const Icon(Icons.refresh, size: 16),
                            label: const Text('Try reloading catalog'),
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
                    child: Material(
                      color: Colors.transparent,
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
                  ),

                const SizedBox(height: 12),

                // Selected / Custom Food Indicator Card
                if (hasCatalogSelection)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.primaryMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(
                          color: colors.primary.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_rounded, color: colors.primary, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${_selectedFood!['name']}',
                                style: TextStyle(
                                  color: colors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                'Catalog item • $unitName',
                                style: TextStyle(color: colors.textSecondary, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        InkWell(
                          onTap: _clearSelectedFood,
                          borderRadius: BorderRadius.circular(4),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Text(
                              'Use Custom',
                              style: TextStyle(
                                color: colors.primary,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else if (hasCustomName)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.primaryMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(
                          color: colors.primary.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.restaurant, color: colors.primary, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Custom Food: "${_labelCtrl.text.trim()}"',
                                style: TextStyle(
                                  color: colors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                'Direct plan item • Unit: $_selectedUnitName',
                                style: TextStyle(color: colors.textSecondary, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: colors.textMuted, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Pick from catalog above or enter a custom food below.',
                            style: TextStyle(color: colors.textMuted, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),

                const SizedBox(height: 14),

                _field(
                  label: hasCatalogSelection
                      ? 'Custom label override (optional)'
                      : 'Food Name / Custom Label *',
                  controller: _labelCtrl,
                  hint: hasCatalogSelection
                      ? 'e.g. Extra seasoned, Half portion'
                      : 'e.g. Chicken breast, Protein shake, ujumji',
                ),

                const SizedBox(height: 12),

                _field(
                  label: 'Quantity',
                  controller: _quantityCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  hint: 'e.g. 150',
                ),

                const SizedBox(height: 12),

                // Serving Unit Selection
                Row(
                  children: [
                    Text(
                      'Unit:',
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          {'id': 1, 'name': 'g'},
                          {'id': 2, 'name': 'kg'},
                          {'id': 3, 'name': 'ml'},
                          {'id': 5, 'name': 'serving'},
                          {'id': 6, 'name': 'piece'},
                        ].map((u) {
                          final isSel = _selectedUnitId == u['id'];
                          return ChoiceChip(
                            label: Text(u['name'] as String),
                            selected: isSel,
                            selectedColor: colors.primary,
                            backgroundColor: colors.card,
                            labelStyle: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isSel ? colors.onPrimary : colors.textPrimary,
                            ),
                            side: BorderSide(
                              color: isSel ? colors.primary : colors.border,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            onSelected: (_) => setState(() {
                              _selectedUnitId = u['id'] as int;
                              _selectedUnitName = u['name'] as String;
                            }),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
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
